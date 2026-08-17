import axios from 'axios'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 12 * 1024 * 1024 // keep in sync with middleware/upload.js

// Lets a photo-taking route accept EITHER a multipart file (req.file, via
// middleware/upload.js) OR a plain public image URL (req.body.photoUrl).
// When only a URL is given, this fetches it server-side into the same
// { buffer, mimetype } shape req.file already has, so downstream route code
// never needs to know which path was used. This is what lets the app run
// with zero tunnel/PUBLIC_BASE_URL setup — the user just pastes a link to
// an already-public photo instead of uploading a file we'd have to host.
export async function resolvePhoto(req, _res, next) {
  if (req.file) return next()

  const photoUrl = req.body?.photoUrl
  if (!photoUrl) return next()

  try {
    const response = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      maxContentLength: MAX_BYTES
    })
    const mimetype = (response.headers['content-type'] || '').split(';')[0] || 'image/jpeg'
    if (!ALLOWED_MIME.has(mimetype)) {
      const err = new Error(`photoUrl did not return a supported image type (got "${mimetype || 'unknown'}")`)
      err.code = 'PHOTO_URL_BAD_TYPE'
      throw err
    }

    const buffer = Buffer.from(response.data)
    req.file = { buffer, mimetype, originalname: 'photo', size: buffer.length }
    next()
  } catch (err) {
    if (err.code === 'PHOTO_URL_BAD_TYPE') {
      return _res.status(415).json({ message: err.message + ' — use a direct JPG/PNG/WEBP image link.' })
    }
    console.error('resolvePhoto: could not fetch photoUrl:', err.message)
    _res.status(400).json({
      message: 'Could not download the photo from that URL. Make sure it\u2019s a direct, publicly accessible image link (not a page that just shows the image).'
    })
  }
}
