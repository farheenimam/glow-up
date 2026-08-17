import axios from 'axios'

// Thin wrapper around the Groq API (OpenAI-compatible chat completions).
// Used by multiAgentStylist.js for the 3-agent styling pipeline — moved
// here from Gemini because Gemini's 2.5/3.x "thinking" models were too
// slow for 3 sequential calls in one request, causing 30s timeouts.
// Groq's inference is dramatically faster, which fixes that without
// needing to parallelize the agent chain (each agent still depends on the
// previous one's output, so they can't run concurrently).

const API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const API_KEY = process.env.GROQ_API_KEY
// openai/gpt-oss-120b: current recommended production model for
// structured/JSON reasoning tasks (Groq deprecated the llama-3.3-70b family
// this now supersedes). Override with GROQ_MODEL in .env if needed.
//
// IMPORTANT: do NOT point this at 'groq/compound' (or 'compound-beta').
// Compound is an agentic system that silently runs its own web_search /
// visit_website tool calls behind the scenes and stuffs the fetched pages
// back into the model's context before it answers. On a 3-call chained
// pipeline like ours that's what was blowing past Groq's request size
// limit (413 request_too_large) even though our own prompts are tiny.
// Compound also doesn't support response_format: json_object, which is
// required below. gpt-oss-120b is a plain instruct model — no hidden tool
// calls, full JSON-mode support, and it's the model the rest of this file
// was already written for.
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'

export function isGroqConfigured() {
  return Boolean(API_KEY && !API_KEY.startsWith('REPLACE_WITH'))
}

function assertConfigured() {
  if (!isGroqConfigured()) {
    const err = new Error('GROQ_API_KEY is not configured on the backend')
    err.code = 'GROQ_NOT_CONFIGURED'
    throw err
  }
}

function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

// Groq's free/on_demand tier has a low tokens-per-minute (TPM) budget
// (e.g. 8000 TPM for gpt-oss-120b at time of writing) that a 3-call
// sequential pipeline can burn through in a single request. 429
// rate_limit_exceeded responses include the model's own wait estimate in
// the message, e.g. "Please try again in 10.08s" — parse and honor that
// instead of a fixed guess. Falls back to exponential backoff if the
// message can't be parsed.
function parseRetryAfterSeconds(errBody) {
  const msg = errBody?.error?.message || ''
  const match = msg.match(/try again in (\d+(?:\.\d+)?)s/i)
  return match ? parseFloat(match[1]) : null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Calls Groq with a system prompt that demands JSON-only output, and
// parses the result. Throws GROQ_BAD_JSON if the model didn't return
// parseable JSON — callers should treat that the same as a network failure
// and fall back to a deterministic result. Retries once on a 429 (rate
// limit) using the server's suggested wait time, since that's a transient
// condition that resolves itself a few seconds later rather than a real
// failure — throws only if the retry also fails.
export async function callGroqJSON({ system, prompt, maxTokens = 1500, temperature = 0.4, _retried = false }) {
  assertConfigured()

  let data
  try {
    ;({ data } = await axios.post(
      API_URL,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'content-type': 'application/json'
        },
        timeout: 30000
      }
    ))
  } catch (err) {
    // Same visibility fix as geminiClient.js/anthropicClient.js — log the
    // real response body instead of letting axios's generic error code
    // hide it.
    const status = err?.response?.status
    const body = err?.response?.data
    console.error('[groqClient] HTTP error:', status, JSON.stringify(body ?? err.message))

    if (status === 429 && !_retried) {
      const waitSeconds = parseRetryAfterSeconds(body) ?? 5
      console.warn(`[groqClient] rate limited — waiting ${waitSeconds}s and retrying once`)
      await sleep(Math.ceil(waitSeconds * 1000) + 250) // small buffer past the window reset
      return callGroqJSON({ system, prompt, maxTokens, temperature, _retried: true })
    }

    throw err
  }

  const choice = data?.choices?.[0]
  const raw = choice?.message?.content || ''
  const finishReason = choice?.finish_reason
  const cleaned = stripCodeFence(raw)

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('[groqClient] JSON parse failed, finish_reason:', finishReason, '| raw length:', raw.length)
    const parseErr = new Error('Groq returned output that was not valid JSON')
    parseErr.code = 'GROQ_BAD_JSON'
    parseErr.raw = raw
    parseErr.finishReason = finishReason
    throw parseErr
  }
}