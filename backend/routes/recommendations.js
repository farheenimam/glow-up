import { Router } from 'express'
import { upload, handleUploadErrors } from '../middleware/upload.js'
import { resolvePhoto } from '../middleware/resolvePhoto.js'
import { buildRecommendations, priceForIndex, lengthNote } from '../utils/recommendationEngine.js'
import { runMultiAgentStylist, isStylistGeminiConfigured } from '../utils/multiAgentStylist.js'

const router = Router()

// Maps Agent 3's final_outfit_options (rich per-item outfit structure) onto
// the flat card shape the frontend already renders (RecommendationsStep.jsx
// reads: id, name, rationale, matchScore, price, cultureTag, size, sizeNote,
// imageUrl). Pricing and the length note stay deterministic — we never let
// the LLM invent a price or a fabricated fit claim.
function mapAgentOutputToItems({ agent3 }, { culture, budget, heightCm, clothingSize }) {
  const options = Array.isArray(agent3?.final_outfit_options) ? agent3.final_outfit_options.slice(0, 3) : []
  if (options.length === 0) return null

  const note = lengthNote(heightCm)
  const cultureTag = (culture || 'Universal').trim() || 'Universal'

  const items = options.map((opt, i) => {
    const name = opt.name || [opt.top, opt.bottom].filter(Boolean).join(' + ') || `Outfit ${i + 1}`
    return {
      id: `outfit_${i + 1}`,
      name,
      rationale: opt.why_it_works || agent3.reasoning || '',
      matchScore: 90 + ((i * 3) % 9),
      price: `Rs. ${priceForIndex(i, budget)}`,
      cultureTag,
      size: clothingSize || null,
      sizeNote: note,
      imageUrl: null,
      // Extra structured detail from the multi-agent pipeline — not read by
      // the current card UI, kept for a future richer outfit view / for
      // feeding into an image-generation or garment-reference pipeline.
      outfitDetail: {
        top: opt.top,
        bottom: opt.bottom,
        shoes: opt.shoes,
        layer: opt.layer,
        accessories: opt.accessories,
        mainColors: opt.main_colors
      },
      imageGenerationPrompt: opt.image_generation_prompt || null
    }
  })

  return items
}

router.post('/', upload.single('photo'), handleUploadErrors, resolvePhoto, async (req, res) => {
  const { bodyShape, culture, country, city, season, weather, occasion, occasionDetail, budget, heightCm, clothingSize, skinToneHex } = req.body

  if (!culture || !country) {
    return res.status(400).json({ message: 'culture and country are required for personalized picks.' })
  }

  const skinProfile = req.body.skinProfile
    ? JSON.parse(req.body.skinProfile)
    : { undertone: 'warm', topConcern: 'hydration' }

  // The user-picked skin tone (color dropper on the frontend) is treated as
  // ground truth for exact color-matching — it's layered on top of
  // whatever YouCam Skin AI returned (undertone/tone/concern), not a
  // replacement for it.
  if (skinToneHex) skinProfile.skinToneHex = skinToneHex

  const profile = { skinProfile, bodyShape, culture, country, city, season, weather, occasion, occasionDetail, budget, heightCm, clothingSize }
  console.log('[recommendations] shopper profile:', profile)

  if (isStylistGeminiConfigured()) {
    try {
      const agentOutput = await runMultiAgentStylist(profile)
      const items = mapAgentOutputToItems(agentOutput, { culture, budget, heightCm, clothingSize })
      if (items) {
        return res.json({ items, source: 'multi_agent', agentTrace: agentOutput })
      }
      // Agent 3 returned no usable outfits — fall through to the rules engine.
      console.warn('[multiAgentStylist] Agent 3 returned no usable outfits — falling back to rules engine.')
    } catch (err) {
      // Any failure (missing/bad key, network issue, non-JSON output) falls
      // back to the deterministic rules engine below — the user always gets
      // a result, per the "never broken" design in the README.
      console.warn('[multiAgentStylist] falling back to rules engine:', err.code || err.message)
      if (err.code === 'GROQ_BAD_JSON' && err.raw) {
        console.warn('[multiAgentStylist] raw Gemini output that failed to parse:', err.raw)
      }
    }
  } else {
    // NOTE: the rules engine below only uses `country` (for climate) — it
    // never reads `city` at all. City-aware recommendations only happen
    // via the Gemini multi-agent pipeline above, which requires
    // GEMINI_API_KEY_2 to be set in backend/.env (a second, separate key
    // from GEMINI_API_KEY, which the image-edit agent uses).
    console.warn('[recommendations] GEMINI_API_KEY_2 not configured — using rules engine (city is ignored in this path).')
  }

  const items = buildRecommendations({ skinProfile, bodyShape, culture, country, season, occasion, budget, heightCm, clothingSize })
  res.json({ items, source: 'rules_engine' })
})

export default router