// Image Edit Prompt Agent.
//
// Sits between the styling pipeline (multiAgentStylist.js, Claude) and the
// YouCam AI Image Generator image-to-image call (youcamClient.js). Its only
// job is to think through exactly how a chosen outfit should be rendered
// onto the shopper's OWN uploaded photo, and turn that into the two inputs
// the YouCam API needs: "prompt" and "negative_prompt". Runs on Gemini
// (GEMINI_API_KEY) rather than Claude, per the app's design of keeping the
// image-editing "thinking" step on a separate model from the styling agents.
//
// If Gemini isn't configured, or it fails, the caller falls back to
// buildFallbackPrompt() below, so image-to-image generation never hard-fails
// just because this one agent step is unavailable.

import { callGeminiJSON, isGeminiConfigured } from './geminiClient.js'

export { isGeminiConfigured }

const SYSTEM = `You are the Image Edit Prompt Agent inside a multi-agent AI personal styling system.

You receive one chosen outfit (already fully specified by earlier styling agents) and the shopper's profile. The shopper has uploaded their own photo, which will be sent to an image-to-image AI model along with whatever prompt you write. Your job is to think through exactly how that outfit should look rendered onto THIS specific photo, then produce the two inputs the image-to-image model needs.

Hard rules:
- Never invent outfit details that were not given to you — describe only what's in the outfit object.
- The edit must preserve the person in the photo: same face, identity, body proportions, pose, and framing. Only the clothing/styling described in the outfit should change, plus any accessories/footwear explicitly listed.
- "prompt": one very short, purely visual sentence or two (roughly 20-45 words total) describing the outfit being worn by the person in the source photo — garment types, colors, fit, footwear, and accessories only. It must explicitly say the person's face, identity, body, and pose stay unchanged, and that only the outfit changes. Do not mention adding any text/logos/watermarks unless the outfit calls for it.
- "negative_prompt": a very short comma-separated list of concrete things to avoid — e.g. changing the face or identity, extra/missing limbs, warped hands, blurry output, unrelated background change, mismatched lighting, and any items not part of the outfit.
- Respond with ONLY a single JSON object — no prose, no markdown code fences, no text before or after it.

Return a JSON object with exactly these keys:
{
  "prompt": string,
  "negative_prompt": string
}`

function buildContextBlock({ outfit, profile }) {
  const outfitBlock = {
    name: outfit?.name,
    top: outfit?.outfitDetail?.top ?? outfit?.top,
    bottom: outfit?.outfitDetail?.bottom ?? outfit?.bottom,
    shoes: outfit?.outfitDetail?.shoes ?? outfit?.shoes,
    layer: outfit?.outfitDetail?.layer ?? outfit?.layer,
    accessories: outfit?.outfitDetail?.accessories ?? outfit?.accessories,
    mainColors: outfit?.outfitDetail?.mainColors ?? outfit?.main_colors
  }

  const profileBlock = {
    occasion: profile?.occasion,
    occasionDetail: profile?.occasionDetail,
    season: profile?.season,
    weather: profile?.weather,
    culture: profile?.culture,
    country: profile?.country
  }

  return JSON.stringify(
    {
      outfit: Object.fromEntries(Object.entries(outfitBlock).filter(([, v]) => v !== undefined && v !== null && v !== '')),
      shopperContext: Object.fromEntries(Object.entries(profileBlock).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    },
    null,
    2
  )
}

function compactOutfitSummary(outfit) {
  const parts = [
    outfit?.outfitDetail?.top ?? outfit?.top,
    outfit?.outfitDetail?.bottom ?? outfit?.bottom,
    outfit?.outfitDetail?.layer ?? outfit?.layer,
    outfit?.outfitDetail?.shoes ?? outfit?.shoes,
    outfit?.outfitDetail?.accessories ?? outfit?.accessories
  ].filter(Boolean)

  if (parts.length) {
    return parts.join(', ')
  }

  return outfit?.name || 'a stylish outfit'
}

// Deterministic fallback used when Gemini isn't configured or fails — keeps
// image-to-image generation working end-to-end without an LLM call.
export function buildFallbackPrompt({ outfit }) {
  const visual = compactOutfitSummary(outfit).slice(0, 180)

  return {
    prompt: `Edit the uploaded photo so the person is wearing: ${visual}. Keep the face, identity, body, and pose exactly the same; change only the clothing, footwear, and accessories described.`,
    negative_prompt:
      'changed face, different identity, extra limbs, warped hands, blurry output, unrelated background change, mismatched lighting'
  }
}

export async function buildImageEditPrompt({ outfit, profile }) {
  if (!isGeminiConfigured()) {
    return { ...buildFallbackPrompt({ outfit }), source: 'fallback_not_configured' }
  }

  try {
    const result = await callGeminiJSON({
      system: SYSTEM,
      prompt: `OUTFIT + SHOPPER CONTEXT:\n${buildContextBlock({ outfit, profile })}\n\nProduce the prompt and negative_prompt for the image-to-image edit.`,
      // This client defaults to thinkingLevel 'medium' (it's genuinely
      // reasoning about how the outfit should render, not just doing
      // structured extraction), and on Gemini 3.x thinking tokens share
      // the same maxOutputTokens budget as the answer. The old 800-token
      // default routinely got eaten entirely by thinking, cutting the
      // response off mid-JSON (see geminiClient.js MAX_TOKENS handling)
      // and falling back to the generic deterministic prompt almost
      // every time. 1600 leaves enough room for thinking + the ~60-120
      // word prompt + negative_prompt without relying on the retry path.
      maxTokens: 1600
    })

    if (!result?.prompt) {
      return { ...buildFallbackPrompt({ outfit }), source: 'fallback_bad_output' }
    }

    return {
      prompt: result.prompt,
      negative_prompt: result.negative_prompt || buildFallbackPrompt({ outfit }).negative_prompt,
      source: 'gemini'
    }
  } catch (err) {
    console.warn('[imageEditPromptAgent] falling back to deterministic prompt:', err.code || err.message)
    return { ...buildFallbackPrompt({ outfit }), source: 'fallback_error' }
  }
}