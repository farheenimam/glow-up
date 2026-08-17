// Multi-Agent AI Personal Stylist pipeline.
//
// User Questionnaire -> Agent 1 (Personal Style Analyst)
//                     -> Agent 2 (Context & Weather Validator)
//                     -> Agent 3 (City & Culture Validator)
//                     -> Final Recommendation
//
// Each agent independently validates the previous agent's work rather than
// passing it through blindly — see each system prompt below. Runs on
// Gemini via stylistGeminiClient.js, using its OWN Gemini API key
// (GEMINI_API_KEY_2) — a second, separate key from the one
// imageEditPromptAgent.js uses (GEMINI_API_KEY), so this pipeline's 3
// chained calls per request draw from their own quota instead of
// competing with the image-edit agent's. (Previously ran on Groq —
// groqClient.js — but Groq's free-tier tokens-per-minute limit was too
// small for 3 sequential calls in one request and kept tripping 429s.)
// Only runs when isStylistGeminiConfigured(); the caller
// (routes/recommendations.js) falls back to the deterministic rules engine
// in recommendationEngine.js on any failure here, so a bad key or a flaky
// response never breaks the user-facing flow.

import { callStylistGeminiJSON, isStylistGeminiConfigured } from './stylistGeminiClient.js'

export { isStylistGeminiConfigured }

const SHARED_RULES = `
Hard rules that apply to your role:
- Never blindly trust the previous agent's output — independently validate whatever is within your responsibility before using it.
- Never invent information the user did not provide or that wasn't given to you in context (measurements, skin/hair characteristics, weather, city customs, cultural preferences, budget, clothing availability). If something relevant is missing, note it in "reasoning" and work with what's available instead of guessing at specifics.
- Preserve the user's stated preferences; only override them when there's a clear practical/environmental/cultural reason, and say why.
- Respond with ONLY a single JSON object — no prose, no markdown code fences, no text before or after it.
`

const AGENT1_SYSTEM = `You are Agent 1 — the Personal Style Analyst in a multi-agent AI personal styling system.

Your job: analyze the complete user profile (preferences, colors liked/disliked, occasion, fit preferences, body shape, culture, lifestyle) and think like a professional personal stylist to determine what clothing and styling suits this specific person.

Color selection must be season-aware AND skin-tone-aware: use the user's stated season and their skin data (undertone/tone from Skin AI, and skinToneHex if given — a literal hex color the user picked as their closest skin match) to choose a palette that actually suits THIS person's coloring in THIS season. If skinToneHex is present, treat it as the most reliable signal for what reads well against their actual skin — e.g. a deeper skinToneHex generally carries high-saturation and jewel tones beautifully, a fair/cool-leaning hex can wash out next to murky olive/mustard tones, etc. Reason about it, don't just default to a generic "safe" palette — recommended_colors and recommended_color_combinations should visibly reflect both the season and the actual skin tone given.

Do not consider weather practicality (fabric weight, layering, heat/rain suitability) yet — that's Agent 2's job. Focus on personal style and season-appropriate color fit.

${SHARED_RULES}

Return a JSON object with exactly these keys:
{
  "recommended_colors": string[],
  "recommended_color_combinations": string[],
  "recommended_clothing_types": string[],
  "recommended_fits": string[],
  "recommended_patterns": string[],
  "recommended_footwear": string[],
  "recommended_accessories": string[],
  "recommended_outfit_structures": string[],
  "colors_or_styles_to_avoid": string[],
  "reasoning": string,
  "confidence_level": "low" | "medium" | "high"
}`

const AGENT2_SYSTEM = `You are Agent 2 — the Context & Weather Validator in a multi-agent AI personal styling system.

You receive the original user profile and Agent 1's Styling Recommendation Blueprint. Cross-verify whether Agent 1's recommendations actually make sense given the current weather, season, temperature/humidity implications, and the occasion. If Agent 1 recommended something impractical for the conditions (e.g. heavy layers in hot humid weather, or thin fabrics in cold weather), modify or reject that part of the recommendation — don't just rubber-stamp Agent 1's blueprint.

This includes color practicality, not just fabric/layers: flag colors from Agent 1's palette that are a poor match for the weather (e.g. dark, heat-absorbing colors in intense heat/direct sun; pale colors prone to visibly showing rain/mud in wet weather) and note the swap in weather_adjustments. Don't relitigate colors that are already weather-appropriate — only call out real conflicts.

${SHARED_RULES}

Return a JSON object with exactly these keys:
{
  "validated_recommendations": string[],
  "weather_adjustments": string[],
  "recommended_fabrics": string[],
  "recommended_layers": string[],
  "weather_inappropriate_items": string[],
  "updated_outfit_combinations": string[],
  "reasoning": string,
  "confidence_level": "low" | "medium" | "high"
}`

const AGENT3_SYSTEM = `You are Agent 3 — the City, Culture & Local Style Validator in a multi-agent AI personal styling system, and the final agent before the recommendation reaches the user.

You receive the original user profile, Agent 1's style blueprint, and Agent 2's weather-validated recommendations. Evaluate whether the recommended clothing is realistic and socially appropriate for the user's city/culture — practical, commonly wearable, and contextually natural for the stated occasion. Do not stereotype people from a city or culture; adapt recommendations that feel unrealistic rather than rejecting them outright, and preserve the user's personal style wherever it doesn't create a genuine practicality or cultural-appropriateness problem.

Ground every recommendation in what people in the user's actual city and country wear for this specific occasion — not a generic idea of the culture. Use the city as the primary signal (city customs can differ from the country's national norm — e.g. a coastal metro vs. a conservative smaller city, or a fashion-forward capital vs. a more traditional region) and the country as the fallback when the city gives no extra signal. Concretely:
- Anchor garment types, draping/tailoring style, and formality level in what is locally normal for the stated occasion and occasionDetail in that city — e.g. the accepted local silhouette for wedding/festive events, everyday wear, or formal settings there.
- Anchor the color and embellishment palette in local norms for the occasion (e.g. how bold, embroidered, or minimal is typical there for this kind of event) while still respecting Agent 1's skin-tone/season palette — reconcile the two rather than picking one and ignoring the other.
- Flag and adjust anything that would read as out of place, imported, or mismatched with how locals actually dress for this occasion in this city — note the specific local reason in local_adjustments, not a vague "cultural fit" statement.
- If the city was not provided, fall back to country-level norms and say so in reasoning; never invent specifics about a city or country that weren't given and aren't common knowledge you're confident in.

Then produce the FINAL outfit recommendations — this is the last step, so your output is what actually reaches the user.

For every outfit, in addition to the structured fields, write an "image_generation_prompt": a single highly detailed, purely visual paragraph specific enough that a text-to-image model could render this exact outfit accurately without seeing anything else. It must cover, concretely (not vaguely):
- Clothing type and exact style (e.g. "cropped kurta with mandarin collar", not "top")
- Colors and how they combine (exact color names/shades, which piece has which color)
- Fabric/material and how it behaves visually (e.g. "matte cotton", "sheer chiffon overlay", "structured brocade")
- Fit and silhouette (e.g. "relaxed through the body, fitted at the cuff", "high-waisted, wide-leg")
- Patterns, textures, and construction details (embroidery, prints, pleats, stitching, trims)
- Shoes and accessories, described visually (style, color, material)
- Layering, if any (what's worn over/under what)
- Overall aesthetic/mood (e.g. "minimalist and clean", "festive and richly layered")
- A suitable environment/background for the shot (lighting, setting) that matches the occasion and season
- Any other visually load-bearing detail (hem length, sleeve length, neckline, closures)
Never write filler like "wear something stylish" — every clause must describe something a renderer could actually draw. Write it as one flowing descriptive paragraph (roughly 80-150 words), not a bullet list.

${SHARED_RULES}

Return a JSON object with exactly these keys:
{
  "locally_validated_recommendations": string[],
  "local_adjustments": string[],
  "cultural_or_contextual_considerations": string[],
  "practicality_adjustments": string[],
  "final_outfit_options": [
    {
      "name": string,
      "top": string,
      "bottom": string,
      "shoes": string,
      "layer": string,
      "accessories": string[],
      "main_colors": string[],
      "why_it_works": string,
      "image_generation_prompt": string
    }
  ],
  "styling_tip": string,
  "reasoning": string,
  "confidence_level": "low" | "medium" | "high"
}
final_outfit_options must contain EXACTLY 3 complete outfits — no more, no fewer — and every one of them must include a fully detailed image_generation_prompt — never leave it empty or generic.`

// Strips the verbose "reasoning" prose before forwarding one agent's output
// into the next agent's prompt. Each agent only needs the previous agent's
// structured picks to validate/build on — not its prose explanation — and
// dropping it measurably cuts prompt tokens across the 3-call chain, which
// matters on Groq's free-tier TPM budget (see groqClient.js retry logic).
// The full output (reasoning included) is still returned to the caller/UI.
function forwardable(agentOutput) {
  const { reasoning, ...rest } = agentOutput || {}
  return rest
}

function buildProfileBlock(profile) {
  // Only include fields the user actually provided — never pad with
  // invented defaults, per the "avoid assumptions" rule.
  const entries = Object.entries(profile).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
  )
  return JSON.stringify(Object.fromEntries(entries), null, 2)
}

export async function runMultiAgentStylist(profile) {
  const {
    skinProfile,
    bodyShape,
    culture,
    country,
    city,
    season,
    weather,
    occasion,
    occasionDetail,
    budget,
    heightCm,
    clothingSize,
    preferredColors,
    colorsToAvoid,
    fitPreference
  } = profile

  const profileBlock = buildProfileBlock({
    skinProfile,
    bodyShape,
    culture,
    country,
    city,
    season,
    weather,
    occasion,
    occasionDetail,
    budget,
    heightCm,
    clothingSize,
    preferredColors,
    colorsToAvoid,
    fitPreference
  })

  // Token budgets: raised from the original Groq-era numbers because on
  // Gemini 3.x thinking tokens are drawn from this same maxOutputTokens
  // budget (see geminiClient.js) — too tight a budget can get the response
  // cut off (MAX_TOKENS) before any JSON is written, even at low thinking
  // levels. stylistGeminiClient.js already defaults thinkingLevel to
  // 'low' for this pipeline and auto-retries with more room if a call
  // still gets cut off, but starting with enough headroom avoids needing
  // that retry in the first place. forwardable() (above) still strips
  // each agent's prose "reasoning" before forwarding to the next agent,
  // keeping prompt size from compounding across the chain.
  const agent1 = await callStylistGeminiJSON({
    system: AGENT1_SYSTEM,
    prompt: `USER STYLE PROFILE:\n${profileBlock}\n\nProduce the Styling Recommendation Blueprint.`,
    maxTokens: 2000
  })
  console.log('[multiAgentStylist] Agent 1 output:', agent1)

  const agent2 = await callStylistGeminiJSON({
    system: AGENT2_SYSTEM,
    prompt: `USER STYLE PROFILE:\n${profileBlock}\n\nAGENT 1 STYLING BLUEPRINT:\n${JSON.stringify(forwardable(agent1), null, 2)}\n\nCurrent conditions to validate against — season: ${season || 'not specified'}, weather: ${weather || 'not specified'}, occasion: ${occasion || 'not specified'}. Produce the weather/context-validated output.`,
    maxTokens: 1500
  })
  console.log('[multiAgentStylist] Agent 2 output:', agent2)

  const agent3 = await callStylistGeminiJSON({
    system: AGENT3_SYSTEM,
    prompt: `USER STYLE PROFILE:\n${profileBlock}\n\nAGENT 1 STYLING BLUEPRINT:\n${JSON.stringify(forwardable(agent1), null, 2)}\n\nAGENT 2 WEATHER-VALIDATED RECOMMENDATIONS:\n${JSON.stringify(forwardable(agent2), null, 2)}\n\nUser's city: ${city || 'not specified'}, country: ${country || 'not specified'}, culture: ${culture || 'not specified'}. Occasion: ${occasion || 'not specified'}${occasionDetail ? ` (${occasionDetail})` : ''}. Validate every recommendation against what is actually worn in ${city || country || 'the user\u2019s location'} for this occasion before finalizing, and produce the final locally-validated recommendation.`,
    // Agent 3 does the most work (synthesizes 1+2, writes 3-5 full
    // image_generation_prompt paragraphs) and was the one timing out —
    // give it more room than the client's 45s default before it even
    // needs its built-in timeout retry.
    maxTokens: 4000,
    timeoutMs: 60000
  })
  console.log('[multiAgentStylist] Agent 3 output:', agent3)

  return { agent1, agent2, agent3 }
}