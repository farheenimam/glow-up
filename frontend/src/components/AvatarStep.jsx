import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import StepShell from './StepShell.jsx'
import Avatar3D from './Avatar3D.jsx'
import { generateAvatar, pollAvatarStatus } from '../lib/api.js'

const STATUS_COPY = {
  queued: 'Queued with Hyper3D…',
  running: 'Sculpting geometry from your photo…',
  texturing: 'Mapping your photo onto the mesh…',
  done: 'Your avatar is ready',
  failed: 'The 3D pass didn\u2019t come back clean this time'
}

export default function AvatarStep({ session, patchSession, onBack, onCheckout, onRestart }) {
  const [status, setStatus] = useState('queued')
  const [errorMsg, setErrorMsg] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let pollTimer

    async function run() {
      try {
        const job = await generateAvatar({
          photoUrl: session.photoUrl,
          outfitId: session.selectedOutfit?.id
        })
        patchSession({ avatarJobId: job.jobId })
        setStatus(job.status || 'queued')

        pollTimer = setInterval(async () => {
          try {
            const res = await pollAvatarStatus(job.jobId)
            setStatus(res.status)
            if (res.status === 'done') {
              patchSession({ avatarModelUrl: res.modelUrl })
              clearInterval(pollTimer)
            }
            if (res.status === 'failed') {
              setErrorMsg(res.message || 'Generation failed — falling back to the 2D try-on render.')
              clearInterval(pollTimer)
            }
          } catch {
            clearInterval(pollTimer)
            setErrorMsg('Lost connection to the avatar job. Your 2D try-on render is still above as a fallback.')
          }
        }, 2500)
      } catch (err) {
        setErrorMsg(
          err?.response?.data?.message ||
            'Couldn\u2019t start the 3D job. Confirm HYPER3D_API_KEY is set on the backend — your 2D try-on result is still saved.'
        )
      }
    }

    run()
    return () => clearInterval(pollTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isDone = status === 'done' && session.avatarModelUrl
  const hasFailed = status === 'failed' || !!errorMsg

  return (
    <StepShell
      eyebrow="Step 06 — Final"
      title="You, rendered in 3D"
      subtitle="Built from your own photo via Hyper3D, textured with your likeness, wearing your recommended outfit. Drag to rotate."
      onBack={onBack}
      hideNext
    >
      <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
        <div className="aspect-square rounded-[1.75rem] bg-gradient-to-br from-graphite to-ink border border-ink/10 overflow-hidden relative">
          {isDone ? (
            <Avatar3D modelUrl={session.avatarModelUrl} />
          ) : hasFailed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              {session.tryOnImageUrl && (
                <img
                  src={session.tryOnImageUrl}
                  alt="2D try-on fallback"
                  className="w-40 h-52 object-cover rounded-xl opacity-80"
                />
              )}
              <p className="text-parchment/80 text-sm max-w-xs">
                {errorMsg || STATUS_COPY.failed}
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
              <motion.div
                className="w-14 h-14 border-2 border-parchment/20 border-t-clay rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              />
              <p className="font-mono text-xs text-parchment/60">{STATUS_COPY[status] || STATUS_COPY.queued}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl mb-2">{session.selectedOutfit?.name}</h3>
            <p className="text-graphite/75 leading-relaxed">{session.selectedOutfit?.rationale}</p>
          </div>

          <div className="flex items-center justify-between bg-white/60 border border-ink/10 rounded-2xl px-5 py-4">
            <span className="font-mono text-clay">{session.selectedOutfit?.price}</span>
            <button
              onClick={onCheckout}
              className="bg-ink text-parchment px-6 py-3 rounded-full text-sm font-medium hover:scale-[1.03] active:scale-[0.97] transition-transform"
            >
              Checkout →
            </button>
          </div>

          <button onClick={onRestart} className="text-sm text-ink/50 hover:text-ink transition-colors">
            ↺ Start over with a new photo
          </button>
        </div>
      </div>
    </StepShell>
  )
}
