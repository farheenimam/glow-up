// Dedicated Gemini client for multiAgentStylist.js — deliberately a SECOND,
// separate API key/quota from the one imageEditPromptAgent.js uses
// (GEMINI_API_KEY). The stylist pipeline makes 3 chained calls per request;
// on a shared key that competed with the image-edit agent's own quota and
// tripped rate limits for both features. Set GEMINI_API_KEY_2 in .env to a
// second key from https://aistudio.google.com/apikey (a second project or
// a second key on the same account both work — the point is a separate
// quota bucket, not a separate account).
//
// Previously this pipeline ran on Groq (see groqClient.js, now unused by
// the stylist) — moved to Gemini because Groq's free-tier TPM limit
// (8000 tokens/min) was too small for a 3-call sequential chain and kept
// falling back to the rules engine. Gemini Flash's free-tier limits are
// far more generous, and keeping prompts trimmed (see forwardable() in
// multiAgentStylist.js) keeps each individual request small regardless.

import { createGeminiClient } from './geminiClient.js'

const stylistClient = createGeminiClient({
  apiKeyEnv: 'GEMINI_API_KEY_2',
  modelEnv: 'GEMINI_MODEL_2',
  apiBaseEnv: 'GEMINI_API_BASE_URL_2',
  thinkingLevelEnv: 'GEMINI_THINKING_LEVEL_2',
  // Each agent here is doing structured extraction/validation against
  // context it's already given, not open-ended reasoning — 'low' leaves
  // most of maxOutputTokens for the actual JSON instead of thinking
  // tokens (see geminiClient.js: on Gemini 3.x, thinking and output share
  // the same budget, and 'medium'/'high' can eat it all before any JSON
  // is written, which is what was causing MAX_TOKENS/empty-output errors).
  defaultThinkingLevel: 'low',
  defaultModel: 'gemini-3.6-flash',
  label: 'stylist'
})

export function isStylistGeminiConfigured() {
  return stylistClient.isConfigured()
}

export function callStylistGeminiJSON(args) {
  return stylistClient.callJSON(args)
}