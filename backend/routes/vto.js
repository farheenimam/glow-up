import { Router } from 'express'
import { generateImageEdit } from '../utils/youcamClient.js'
import { buildImageEditPrompt } from '../utils/imageEditPromptAgent.js'

const router = Router()

// Try-on flow:
//   1. User provides a public photo URL (see UploadStep.jsx — the app asks
//      for a link to an already-hosted photo, so there's nothing for our
//      backend to host itself). The outfit they picked carries Agent 3's
//      structured detail + image_generation_prompt from the styling
//      pipeline (routes/recommendations.js).
//   2. Image Edit Prompt Agent (Gemini) turns that outfit + the shopper's
//      context into { prompt, negative_prompt } for the image-to-image
//      call — falls back to a deterministic prompt if Gemini isn't
//      configured or fails, so this step never hard-blocks the render.
//   3. photoUrl is passed straight through as YouCam's src_file_urls — no
//      re-hosting, no PUBLIC_BASE_URL, no tunnel required.
router.post('/generate', async (req, res) => {
  const photoUrl = req.body.photoUrl || req.body.imageUrl // imageUrl kept as an alias for quick curl testing
  if (!photoUrl) {
    return res.status(400).json({ message: 'photoUrl is required \u2014 a direct, public link to the photo.' })
  }

  let outfit
  try {
    outfit = typeof req.body.outfit === 'string' ? JSON.parse(req.body.outfit) : req.body.outfit
  } catch {
    return res.status(400).json({ message: 'outfit must be valid JSON.' })
  }
  if (!outfit) {
    return res.status(400).json({ message: 'outfit is required (the selected recommendation object).' })
  }

  const profile = {
    occasion: req.body.occasion,
    occasionDetail: req.body.occasionDetail,
    season: req.body.season,
    weather: req.body.weather,
    culture: req.body.culture,
    country: req.body.country
  }

  try {
    const { prompt, negative_prompt: negativePrompt, source: promptSource } = await buildImageEditPrompt({
      outfit,
      profile
    })
    console.log('[imageEditPromptAgent] output:', { promptSource, prompt, negativePrompt })

    const result = await generateImageEdit({
      imageUrl: photoUrl,
      prompt,
      negativePrompt,
      size: req.body.size,
      // Which of up to 4 YouCam keys to run this render on, so a batch of
      // outfit suggestions can be spread across separate quota buckets
      // instead of serializing against one key's rate limit.
      keyIndex: Number.isFinite(Number(req.body.keyIndex)) ? Number(req.body.keyIndex) : 0
    })
    console.log('[youcamClient] generateImageEdit result:', result)

    res.json({
      imageUrl: result.imageUrl,
      prompt,
      negativePrompt,
      promptSource
    })
  } catch (err) {
    if (err.code === 'YOUCAM_NOT_CONFIGURED') {
      return res.status(503).json({
        message: 'YouCam API key is not configured on the server yet. Add YOUCAM_API_KEY to backend/.env.'
      })
    }
    console.error('AI Image Generator try-on failed:', err?.response?.data || err.message)
    res.status(502).json({ message: 'The AI render did not come back. Please try again.' })
  }
})

export default router