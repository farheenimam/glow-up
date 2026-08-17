import { Router } from 'express'
import { upload, handleUploadErrors } from '../middleware/upload.js'
import { resolvePhoto } from '../middleware/resolvePhoto.js'
import { analyzeSkin } from '../utils/youcamClient.js'

const router = Router()

router.post('/analyze', upload.single('photo'), handleUploadErrors, resolvePhoto, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'A photo file or photoUrl is required.' })

  try {
    const result = await analyzeSkin(req.file.buffer, req.file.mimetype)

    // Body shape is NOT part of this response — YouCam's Skin APIs don't
    // return it. It's collected as an honest user self-select in
    // PersonalizeStep.jsx and travels through session state instead.
    res.json({
      skinProfile: {
        undertone: result.undertone,
        tone: result.tone,
        topConcern: result.top_concern
      }
    })
  } catch (err) {
    if (err.code === 'YOUCAM_NOT_CONFIGURED') {
      return res.status(503).json({
        message: 'YouCam API key is not configured on the server yet. Add YOUCAM_API_KEY to backend/.env.'
      })
    }
    console.error('Skin analysis failed:', err?.response?.data || err.message)
    res.status(502).json({ message: 'Skin AI did not return a result. Please try again.' })
  }
})

export default router
