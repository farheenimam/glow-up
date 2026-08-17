import { Router } from 'express'
import { upload, handleUploadErrors } from '../middleware/upload.js'
import { resolvePhoto } from '../middleware/resolvePhoto.js'
import { v4 as uuid } from 'uuid'
import { submitAvatarJob, getAvatarJobStatus, downloadAvatarModel } from '../utils/hyper3dClient.js'

const router = Router()

// In-memory job map is fine for a hackathon demo (single-process). For real
// production use, back this with Redis/DB so it survives restarts and scales
// across instances.
const jobs = new Map()

router.post('/generate', upload.single('photo'), handleUploadErrors, resolvePhoto, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'A photo file or photoUrl is required.' })

  const localJobId = uuid()

  try {
    const { jobId: remoteJobId, subscriptionKey } = await submitAvatarJob({
      photoBuffer: req.file.buffer,
      mimeType: req.file.mimetype
    })

    jobs.set(localJobId, { remoteJobId, subscriptionKey, status: 'running', modelUrl: null })
    res.json({ jobId: localJobId, status: 'running' })
  } catch (err) {
    if (err.code === 'HYPER3D_NOT_CONFIGURED') {
      return res.status(503).json({
        message: 'Hyper3D API key is not configured on the server yet. Add HYPER3D_API_KEY to backend/.env.'
      })
    }
    console.error('Avatar job submission failed:', err?.response?.data || err.message)
    res.status(502).json({ message: 'Could not start the 3D avatar job. Please try again.' })
  }
})

router.get('/status/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ message: 'Unknown job.' })
  if (job.status === 'done' || job.status === 'failed') return res.json(job)

  try {
    const status = await getAvatarJobStatus(job.remoteJobId, job.subscriptionKey)
    job.status = status

    if (status === 'done') {
      job.modelUrl = await downloadAvatarModel(job.remoteJobId)
    }
    jobs.set(req.params.jobId, job)
    res.json(job)
  } catch (err) {
    console.error('Avatar status check failed:', err?.response?.data || err.message)
    job.status = 'failed'
    job.message = 'Lost connection to the 3D rendering service.'
    res.json(job)
  }
})

export default router
