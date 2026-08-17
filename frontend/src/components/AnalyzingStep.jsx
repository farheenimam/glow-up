import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { getRecommendations } from '../lib/api.js'

const PHASES = [
  'Agents are personalizing your recommendations',
  'Applying your body shape',
  'Cross-referencing your culture and city',
  'Matching climate-appropriate makeup',
  'Curating your top picks'
]

export default function AnalyzingStep({ session, patchSession, onComplete }) {
  const [phase, setPhase] = useState(0)
  const [error, setError] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const phaseTimer = setInterval(() => {
      setPhase((p) => Math.min(p + 1, PHASES.length - 1))
    }, 900)

    async function run() {
      try {
        // Skin analysis is temporarily disabled — the recommendation
        // engine falls back to the manual skin-tone picker from
        // PersonalizeStep (session.skinToneHex) instead of Skin AI.
        const recs = await getRecommendations({
          photoUrl: session.photoUrl,
          bodyShape: session.bodyShape,
          skinProfile: null,
          skinToneHex: session.skinToneHex,
          culture: session.culture,
          country: session.country,
          city: session.city,
          season: session.season,
          weather: session.weather,
          occasion: session.occasion,
          occasionDetail: session.occasionDetail,
          budget: session.budget,
          heightCm: session.heightCm,
          clothingSize: session.clothingSize
        })

        patchSession({
          skinProfile: null,
          recommendations: recs.items
        })
        clearInterval(phaseTimer)
        setTimeout(onComplete, 400)
      } catch (err) {
        clearInterval(phaseTimer)
        setError(
          err?.response?.data?.message ||
            'The AI services didn\u2019t respond in time. Check that YOUCAM_API_KEY is set on the backend and try again.'
        )
      }
    }

    run()
    return () => clearInterval(phaseTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-6 pt-40 pb-20 text-center">
      <motion.div
        className="w-24 h-24 mx-auto mb-10 rounded-full border-2 border-ink/15 relative"
        animate={{ rotate: 360 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
      >
        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-clay" />
      </motion.div>

      <h2 className="font-display text-3xl mb-8">Reading your photo</h2>

      <div className="space-y-3 max-w-sm mx-auto text-left">
        {PHASES.map((p, i) => (
          <div key={p} className="flex items-center gap-3">
            <span
              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[10px] ${
                i < phase
                  ? 'bg-moss border-moss text-parchment'
                  : i === phase
                  ? 'border-clay text-clay'
                  : 'border-ink/20 text-transparent'
              }`}
            >
              {i < phase ? '✓' : '•'}
            </span>
            <span className={i <= phase ? 'text-ink' : 'text-ink/35'}>{p}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-10 bg-rose/15 border border-rose/30 rounded-xl px-5 py-4 text-sm text-graphite">
          {error}
        </div>
      )}
    </div>
  )
}