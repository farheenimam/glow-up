import axios from 'axios'

// Thin wrapper around the Anthropic Messages API. Used by
// multiAgentStylist.js to run the 3-agent styling pipeline. Only used when
// ANTHROPIC_API_KEY is actually configured — everything upstream falls back
// to the deterministic rules engine in recommendationEngine.js otherwise.

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'

export function isAnthropicConfigured() {
  return Boolean(API_KEY && !API_KEY.startsWith('REPLACE_WITH'))
}

function assertConfigured() {
  if (!isAnthropicConfigured()) {
    const err = new Error('ANTHROPIC_API_KEY is not configured on the backend')
    err.code = 'ANTHROPIC_NOT_CONFIGURED'
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

// Calls Claude with a system prompt that demands JSON-only output, and
// parses the result. Throws ANTHROPIC_BAD_JSON if the model didn't return
// parseable JSON — callers should treat that the same as a network failure
// and fall back to the rules engine.
export async function callClaudeJSON({ system, prompt, maxTokens = 1400 }) {
  assertConfigured()

  const { data } = await axios.post(
    API_URL,
    {
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json'
      },
      timeout: 30000
    }
  )

  const textBlock = (data.content || []).find((block) => block.type === 'text')
  const raw = textBlock?.text || ''
  const cleaned = stripCodeFence(raw)

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    const parseErr = new Error('Claude returned output that was not valid JSON')
    parseErr.code = 'ANTHROPIC_BAD_JSON'
    parseErr.raw = raw
    throw parseErr
  }
}
