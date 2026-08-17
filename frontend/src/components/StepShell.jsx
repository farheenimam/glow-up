export default function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = 'Continue →',
  hideNext = false
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-32 pb-20">
      <p className="font-mono text-xs tracking-[0.25em] uppercase text-clay mb-3">{eyebrow}</p>
      <h2 className="font-display text-4xl md:text-5xl mb-4 max-w-2xl leading-tight">{title}</h2>
      {subtitle && <p className="text-graphite/75 max-w-xl mb-12 leading-relaxed">{subtitle}</p>}

      <div className="mb-14">{children}</div>

      <div className="flex items-center justify-between border-t border-ink/10 pt-6">
        <button
          onClick={onBack}
          className="text-sm font-medium text-ink/50 hover:text-ink transition-colors"
        >
          ← Back
        </button>
        {!hideNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="bg-ink text-parchment px-7 py-3.5 rounded-full font-medium tracking-wide disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  )
}
