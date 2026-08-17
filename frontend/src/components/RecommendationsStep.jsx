import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import StepShell from './StepShell.jsx'
import { generateTryOn } from '../lib/api.js'

// Cards that aren't an actual outfit (the styling tip, the climate-matched
// makeup pick) — skip these in the YouCam render loop, just show them as-is.
const NON_OUTFIT_IDS = new Set(['styling_tip', 'makeup_pick'])

export default function RecommendationsStep({ session, patchSession, onSelect, onBack }) {
  const { skinProfile, bodyShape, recommendations, renderState = {} } = session

  // Per-item YouCam render state, keyed by recommendation id:
  // { status: 'pending' | 'loading' | 'done' | 'error', imageUrl, error }
  const [renders, setRenders] = useState(renderState)
  const started = useRef(false)

  const visibleRecommendations = recommendations
    .filter((item) => !NON_OUTFIT_IDS.has(item.id))
    .slice(0, 3)

  useEffect(() => {
    setRenders(renderState)
  }, [renderState])

  useEffect(() => {
    // Guards against React 18 StrictMode's dev-only double-invoke of
    // effects (mount -> cleanup -> mount) starting this loop twice. We
    // deliberately do NOT pair this with a "cancelled" flag tied to the
    // cleanup: that combination is what caused renders to get stuck on
    // "loading" forever — the decoy cleanup from the double-invoke would
    // flip cancelled=true, and every subsequent setRenders() in the
    // already-running loop would then see cancelled and bail, even though
    // YouCam had already returned a real image and the component was
    // still mounted for real. The started ref alone is enough to prevent
    // firing the network calls twice; letting the one real loop run to
    // completion and update state is what we actually want.
    if (started.current) return
    started.current = true
    if (!visibleRecommendations.length) return

    const missingItems = visibleRecommendations.filter((item) => !renderState[item.id])
    if (!missingItems.length) return

    // Fire all outfit renders at once instead of one-at-a-time. The
    // backend already rotates each request across up to 4 separate
    // YouCam keys/accounts (keyIndex) specifically so a batch like this
    // can run concurrently without piling onto one key's rate limit —
    // but awaiting them inside a for-loop meant every render still
    // waited for the previous one to finish first, turning what should
    // be one render's worth of wait time into N renders' worth stacked
    // back to back. Promise.allSettled runs them together and still
    // lets each card update independently (and a slow/failed render on
    // one card doesn't block the others from finishing).
    async function runInParallel() {
      const next = { ...renders }
      missingItems.forEach((item) => {
        next[item.id] = { status: 'loading' }
      })
      setRenders(next)
      patchSession({ renderState: next })

      await Promise.allSettled(
        missingItems.map(async (item, keyIndex) => {
          try {
            const res = await generateTryOn({
              photoUrl: session.photoUrl,
              outfit: item,
              occasion: session.occasion,
              occasionDetail: session.occasionDetail,
              season: session.season,
              weather: session.weather,
              culture: session.culture,
              country: session.country,
              keyIndex: keyIndex % 4
            })
            const nextState = { ...renders, [item.id]: { status: 'done', imageUrl: res.imageUrl } }
            setRenders(nextState)
            patchSession({ renderState: nextState })
          } catch (err) {
            const nextState = {
              ...renders,
              [item.id]: {
                status: 'error',
                error: err?.response?.data?.message || 'Render failed — showing the product photo instead.'
              }
            }
            setRenders(nextState)
            patchSession({ renderState: nextState })
          }
        })
      )
    }

    runInParallel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRecommendations, renderState])

  function handleSelect(item) {
    const render = renders[item.id]
    onSelect(render?.status === 'done' ? { ...item, tryOnImageUrl: render.imageUrl } : item)
  }

  return (
    <StepShell
      eyebrow="Step 04"
      title="Curated for your skin, shape & culture"
      subtitle="Every pick below accounts for your undertone, your body shape, and what you told us about your culture and climate — rendered on your own photo via YouCam, one look at a time."
      onBack={onBack}
      hideNext
    >
      {skinProfile && (
        <div className="flex flex-wrap gap-3 mb-10">
          <Chip label={`Undertone: ${skinProfile.undertone}`} />
          <Chip label={`Depth: ${skinProfile.tone}`} />
          <Chip label={`Body shape: ${bodyShape}`} />
          <Chip label={`Top concern: ${skinProfile.topConcern}`} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleRecommendations.map((item, i) => {
          const render = renders[item.id]
          const displayImage = render?.status === 'done' ? render.imageUrl : item.imageUrl

          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 24 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(item)}
              className="text-left bg-white/60 border border-ink/10 rounded-2xl overflow-hidden group shadow-sm hover:shadow-editorial transition-shadow"
            >
              <div className="aspect-[3/4] bg-sand relative overflow-hidden">
                {render?.status === 'loading' && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-sand/90">
                    <motion.div
                      className="w-8 h-8 border-2 border-ink/20 border-t-clay rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <p className="font-mono text-[11px] text-ink/50">Rendering on you…</p>
                  </div>
                )}

                {displayImage ? (
                  <img src={displayImage} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-display italic text-ink/30 text-2xl">
                    {item.name}
                  </div>
                )}

                {render?.status === 'error' && (
                  <span className="absolute bottom-3 left-3 right-3 bg-ink/80 text-parchment text-[11px] font-mono px-2.5 py-1.5 rounded-lg">
                    {render.error}
                  </span>
                )}

                <span className="absolute top-3 right-3 bg-ink text-parchment text-xs font-mono px-2.5 py-1 rounded-full">
                  {item.matchScore}% match
                </span>
              </div>
              <div className="p-4">
                <p className="font-display text-lg mb-1">{item.name}</p>
                <p className="text-sm text-graphite/70 mb-3">{item.rationale}</p>
                {(item.size || item.sizeNote) && (
                  <p className="text-xs text-ink/45 mb-3 font-mono">
                    {item.size ? `Your size: ${item.size}` : ''}
                    {item.size && item.sizeNote ? ' · ' : ''}
                    {item.sizeNote || ''}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-clay">{item.price}</span>
                  <span className="text-xs uppercase tracking-wide text-ink/40">{item.cultureTag}</span>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </StepShell>
  )
}

function Chip({ label }) {
  return (
    <span className="font-mono text-xs uppercase tracking-wide bg-ink text-parchment px-3 py-1.5 rounded-full">
      {label}
    </span>
  )
}