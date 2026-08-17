import { motion } from 'framer-motion'

const LABELS = [
  { key: 'upload', label: '01 — Photo' },
  { key: 'personalize', label: '02 — You' },
  { key: 'analyzing', label: '03 — Read' },
  { key: 'recommendations', label: '04 — Curate' },
  { key: 'tryon', label: '05 — Your Look' }
]

export default function ProgressRail({ current }) {
  const idx = LABELS.findIndex((s) => s.key === current)

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-parchment/90 backdrop-blur border-b border-ink/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <span className="font-display italic text-lg tracking-tight">GlowMatch</span>
        <div className="hidden md:flex items-center gap-1">
          {LABELS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <span
                className={`relative font-mono text-[11px] tracking-wide px-2 py-1 rounded-full ${
                  i === idx ? 'text-parchment' : i < idx ? 'text-moss' : 'text-ink/30'
                }`}
              >
                {i === idx && (
                  <motion.span
                    layoutId="progress-pill"
                    className="absolute inset-0 bg-ink rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                {s.label}
              </span>
              {i < LABELS.length - 1 && <span className="w-3 h-px bg-ink/15 mx-0.5" />}
            </div>
          ))}
        </div>
        <div className="w-24 h-1 bg-ink/10 rounded-full overflow-hidden md:hidden">
          <motion.div
            className="h-full bg-clay"
            animate={{ width: `${((idx + 1) / LABELS.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          />
        </div>
      </div>
    </div>
  )
}