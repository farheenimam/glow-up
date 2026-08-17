import multer from 'multer'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 12 * 1024 * 1024 // 12MB

// Memory storage: we forward the buffer straight to YouCam/Hyper3D and never
// write uploaded photos to disk, so there's nothing left behind to clean up
// or accidentally serve back out.
const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('UNSUPPORTED_FILE_TYPE'))
    }
    cb(null, true)
  }
})

export function handleUploadErrors(err, _req, res, next) {
  if (!err) return next()
  if (err.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(415).json({ message: 'Only JPG, PNG, or WEBP photos are supported.' })
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Photo is larger than the 12MB limit.' })
  }
  return res.status(400).json({ message: 'Could not process the uploaded file.' })
}
