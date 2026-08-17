import { useState } from 'react'
import { motion } from 'framer-motion'
import StepShell from './StepShell.jsx'

const TIPS = [
  'Face the camera, shoulders square — not a side angle',
  'Even, bright light. Avoid hard shadows across the face',
  'Full body in frame if you want body-shape recommendations',
  'Plain background helps the AI separate you from the scene',
  'Must be a direct image link (ends in .jpg/.png/.webp, or a hosting link that resolves straight to the image) — not a page that just shows the photo'
]

function looksLikeUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export default function UploadStep({ session, patchSession, onNext, onBack }) {
  const [inputValue, setInputValue] = useState(session.photoUrl || '')
  const [warning, setWarning] = useState(null)
  const [checking, setChecking] = useState(false)

  const commitUrl = (value) => {
    setInputValue(value)
    if (!value) {
      setWarning(null)
      patchSession({ photoUrl: '' })
      return
    }
    if (!looksLikeUrl(value)) {
      setWarning('That doesn\u2019t look like a valid URL — it should start with http:// or https://')
      patchSession({ photoUrl: '' })
      return
    }

    // Try loading it as an image client-side before committing — catches
    // broken links and non-image pages before the user moves on.
    setChecking(true)
    const img = new Image()
    img.onload = () => {
      setChecking(false)
      if (img.width < 480 || img.height < 480) {
        setWarning('This photo is quite small — the skin analysis and 3D likeness will be sharper with a higher-resolution shot.')
      } else {
        setWarning(null)
      }
      patchSession({ photoUrl: value })
    }
    img.onerror = () => {
      setChecking(false)
      setWarning('Couldn\u2019t load an image from that link. Make sure it\u2019s a direct, publicly accessible image URL.')
      patchSession({ photoUrl: '' })
    }
    img.src = value
  }

  return (
    <StepShell
      eyebrow="Step 01"
      title="Start with one honest photo"
      subtitle="Paste a link to a photo that's already public (e.g. an Imgur/Drive share link, a CDN URL). Front-facing, well lit, ideally full body — this one photo powers your skin read, your fit, and your 3D avatar."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!session.photoUrl || checking}
      nextLabel="Personalize my picks →"
    >
      <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
        <div>
          <div className="relative aspect-[4/5] rounded-[1.75rem] border-2 border-dashed border-ink/25 bg-sand/50 overflow-hidden flex items-center justify-center">
            {session.photoUrl ? (
              <img src={session.photoUrl} alt="Your photo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center px-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ink/5 flex items-center justify-center font-display italic text-2xl">
                  +
                </div>
                <p className="font-medium mb-1">Paste your photo URL below</p>
                <p className="text-sm text-ink/50">A public link to a JPG / PNG / WEBP</p>
              </div>
            )}
          </div>

          <input
            type="url"
            value={inputValue}
            onChange={(e) => commitUrl(e.target.value)}
            placeholder="https://example.com/your-photo.jpg"
            className="w-full mt-4 bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-lg transition-colors"
          />
          {checking && <p className="text-sm text-ink/50 mt-2">Checking the link…</p>}
        </div>

        <div>
          <h3 className="font-display text-xl mb-4">For the sharpest results</h3>
          <ul className="space-y-3 mb-6">
            {TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-3 text-graphite/80">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-clay shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          {warning && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm bg-rose/15 text-graphite border border-rose/30 rounded-xl px-4 py-3"
            >
              {warning}
            </motion.p>
          )}
          <p className="text-xs text-ink/40 font-mono mt-6 leading-relaxed">
            Your photo URL is sent only to our server, which forwards it to YouCam
            API / Hyper3D for this session and is not stored beyond generating
            your results.
          </p>
        </div>
      </div>
    </StepShell>
  )
}
