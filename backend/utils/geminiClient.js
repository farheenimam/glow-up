import axios from 'axios'

// Thin wrapper around the Google Gemini API (generateContent).
//
// This is a CLIENT FACTORY, not a single client — different features hold
// their own Gemini API key/model so they don't share one quota:
//   - imageEditPromptAgent.js uses the default export below (GEMINI_API_KEY),
//     to "think" through how an outfit should be rendered onto the
//     shopper's own photo for YouCam's image-to-image call.
//   - multiAgentStylist.js uses stylistGeminiClient.js, which calls
//     createGeminiClient() with a SEPARATE key (GEMINI_API_KEY_2) so its
//     3-call-per-request pipeline can't exhaust the image-edit agent's
//     quota (or vice versa).
// Each instance is independently optional — callers fall back to a
// deterministic result when their specific key isn't configured.

const DEFAULT_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function stripCodeFence(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Gemini's 429 body shape (Google API style) carries the retry hint in
// error.details[].retryDelay (e.g. "9s"), not in the message text like
// Groq — parse that, falling back to a fixed guess if it's missing.
function parseRetryDelaySeconds(errBody) {
  const details = errBody?.error?.details
  if (Array.isArray(details)) {
    for (const d of details) {
      if (typeof d?.retryDelay === 'string') {
        const match = d.retryDelay.match(/(\d+(?:\.\d+)?)s/)
        if (match) return parseFloat(match[1])
      }
    }
  }
  return null
}

// apiKeyEnv/modelEnv: names of the env vars this instance reads its key and
// model override from (so two instances never accidentally share a key).
// thinkingLevelEnv/defaultThinkingLevel: same idea for thinking level.
// label: short tag used in log lines to tell instances apart.
export function createGeminiClient({ apiKeyEnv, modelEnv, defaultModel, apiBaseEnv, thinkingLevelEnv, defaultThinkingLevel = 'medium', label }) {
  const API_KEY = process.env[apiKeyEnv]
  const API_BASE = process.env[apiBaseEnv] || DEFAULT_API_BASE
  const MODEL = process.env[modelEnv] || defaultModel
  // Gemini 3.x uses "thinkingLevel" (low/medium/high) instead of the old
  // 2.5-era "thinkingBudget" token count. IMPORTANT: on Gemini 3.x models,
  // thinking tokens are drawn from the SAME maxOutputTokens budget as the
  // actual answer — at 'medium'/'high' with a modest maxTokens, the model
  // can burn the whole budget "thinking" and get cut off (finishReason
  // MAX_TOKENS) before writing any of the requested JSON. Callers that
  // want fast structured output with little budget should pass a lower
  // thinkingLevelEnv default (e.g. 'low').
  const THINKING_LEVEL = process.env[thinkingLevelEnv] || defaultThinkingLevel
  const tag = `[geminiClient:${label}]`

  function isConfigured() {
    return Boolean(API_KEY && !API_KEY.startsWith('REPLACE_WITH'))
  }

  function assertConfigured() {
    if (!isConfigured()) {
      const err = new Error(`${apiKeyEnv} is not configured on the backend`)
      err.code = 'GEMINI_NOT_CONFIGURED'
      throw err
    }
  }

  // Calls Gemini with a system instruction that demands JSON-only output,
  // and parses the result. Throws GEMINI_BAD_JSON if the model didn't
  // return parseable JSON — callers should treat that the same as a
  // network failure and fall back to a deterministic result. Retries once
  // on a 429 using Gemini's own suggested retry delay when present, and
  // separately retries once on a MAX_TOKENS cutoff by lowering the
  // thinking level to 'low' and raising the token budget — this recovers
  // automatically from the "thinking ate the whole budget" failure mode
  // described above without every caller having to hand-tune maxTokens.
  async function callJSON({
    system,
    prompt,
    maxTokens = 800,
    temperature = 0.4,
    timeoutMs = 45000,
    _retriedRateLimit = false,
    _retriedMaxTokens = false,
    _retriedTimeout = false
  }) {
    assertConfigured()

    let data
    try {
      ;({ data } = await axios.post(
        `${API_BASE}/${MODEL}:generateContent`,
        {
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: _retriedMaxTokens ? 'low' : THINKING_LEVEL }
          }
        },
        {
          headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
          timeout: timeoutMs
        }
      ))
    } catch (err) {
      // axios collapses every 4xx/5xx into a generic ERR_BAD_REQUEST code —
      // the actual reason (bad model name, invalid key, wrong body shape,
      // quota) is in the response body, so log it instead of swallowing it.
      const status = err?.response?.status
      const body = err?.response?.data
      console.error(`${tag} HTTP error:`, status, JSON.stringify(body ?? err.message))

      if (status === 429 && !_retriedRateLimit) {
        const waitSeconds = parseRetryDelaySeconds(body) ?? 5
        console.warn(`${tag} rate limited — waiting ${waitSeconds}s and retrying once`)
        await sleep(Math.ceil(waitSeconds * 1000) + 250)
        return callJSON({
          system,
          prompt,
          maxTokens,
          temperature,
          timeoutMs,
          _retriedRateLimit: true,
          _retriedMaxTokens,
          _retriedTimeout
        })
      }

      // A bare timeout (no response at all — ECONNABORTED, or axios'
      // ETIMEDOUT/"timeout of Nms exceeded") isn't a quota or bad-request
      // problem, it's Gemini just taking longer than usual on that one
      // call. Previously this fell straight through to the caller, which
      // meant one slow call anywhere in the 3-agent chain nuked the whole
      // pipeline back to the generic rules engine (no city/culture
      // awareness). Retry once with extra headroom before giving up.
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')
      if (isTimeout && !_retriedTimeout) {
        console.warn(`${tag} timed out after ${timeoutMs}ms — retrying once with a longer timeout`)
        return callJSON({
          system,
          prompt,
          maxTokens,
          temperature,
          timeoutMs: Math.round(timeoutMs * 1.5),
          _retriedRateLimit,
          _retriedMaxTokens,
          _retriedTimeout: true
        })
      }

      throw err
    }

    const parts = data?.candidates?.[0]?.content?.parts || []
    const raw = parts.map((p) => p.text || '').join('')
    const cleaned = stripCodeFence(raw)
    const finishReason = data?.candidates?.[0]?.finishReason

    // MAX_TOKENS almost always means thinking tokens (and/or the answer
    // itself) ate the whole budget before the JSON finished. This is true
    // whether the response came back completely empty OR truncated
    // mid-string (e.g. raw length 162 cut off inside a "prompt" value) —
    // both cases fail JSON.parse below, so check finishReason up front
    // and retry BEFORE attempting to parse, rather than only retrying
    // when cleaned is empty. Previously a truncated-but-non-empty
    // response skipped the retry entirely and went straight to the
    // deterministic fallback, which is why image-edit prompts kept
    // failing over even though a bigger budget would have fixed them.
    if (finishReason === 'MAX_TOKENS' && !_retriedMaxTokens) {
      const biggerBudget = Math.min(maxTokens * 3, 8192)
      console.warn(`${tag} MAX_TOKENS (raw length ${raw.length}) — retrying once with thinkingLevel=low and maxTokens=${biggerBudget}`)
      return callJSON({
        system,
        prompt,
        maxTokens: biggerBudget,
        temperature,
        timeoutMs,
        _retriedRateLimit,
        _retriedMaxTokens: true,
        _retriedTimeout
      })
    }

    try {
      return JSON.parse(cleaned)
    } catch (err) {
      const parseErr = new Error('Gemini returned output that was not valid JSON')
      parseErr.code = 'GEMINI_BAD_JSON'
      parseErr.raw = raw
      // MAX_TOKENS here means the response was cut off mid-JSON before it
      // could finish — the fix for that is raising maxTokens, not a
      // parsing bug. Any other reason means the model just didn't produce
      // JSON.
      parseErr.finishReason = finishReason
      console.error(`${tag} JSON parse failed, finishReason:`, finishReason, '| raw length:', raw.length)
      throw parseErr
    }
  }

  return { isConfigured, callJSON }
}

// Default instance — used by imageEditPromptAgent.js. Unchanged env vars
// (GEMINI_API_KEY / GEMINI_MODEL / GEMINI_API_BASE_URL /
// GEMINI_THINKING_LEVEL) and export names, so nothing else needs to change
// to keep using this the way it always has.
const defaultClient = createGeminiClient({
  apiKeyEnv: 'GEMINI_API_KEY',
  modelEnv: 'GEMINI_MODEL',
  apiBaseEnv: 'GEMINI_API_BASE_URL',
  thinkingLevelEnv: 'GEMINI_THINKING_LEVEL',
  defaultThinkingLevel: 'medium',
  defaultModel: 'gemini-3.6-flash',
  label: 'image-edit'
})

export function isGeminiConfigured() {
  return defaultClient.isConfigured()
}

export function callGeminiJSON(args) {
  return defaultClient.callJSON(args)
}