import StepShell from './StepShell.jsx'

export default function TryOnStep({ session, onBack, onCheckout }) {
  const outfit = session.selectedOutfit
  const imageUrl = outfit?.tryOnImageUrl || session.tryOnImageUrl

  return (
    <StepShell
      eyebrow="Step 05"
      title={`On you: ${outfit?.name ?? 'your pick'}`}
      subtitle="Rendered on your actual photo via YouCam's AI Image Generator (image-to-image) — generated back in the curator, one request per look."
      onBack={onBack}
      hideNext
    >
      <div className="grid md:grid-cols-[1fr_1fr] gap-10 items-start">
        <div className="aspect-[3/4] rounded-[1.75rem] bg-sand border border-ink/10 overflow-hidden relative">
          {imageUrl ? (
            <img src={imageUrl} alt="Virtual try-on result" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <p className="text-sm text-graphite/70">
                No render came back for this pick — go back and try selecting it again.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-display text-xl mb-2">Why this fits</h3>
            <p className="text-graphite/75 leading-relaxed">{outfit?.rationale}</p>
          </div>
          <div className="flex items-center justify-between bg-white/60 border border-ink/10 rounded-2xl px-5 py-4">
            <div>
              <p className="font-medium">{outfit?.name}</p>
              <p className="font-mono text-clay text-sm">{outfit?.price}</p>
            </div>
            <button
              onClick={onCheckout}
              className="bg-clay text-parchment px-5 py-2.5 rounded-full text-sm font-medium hover:scale-[1.03] active:scale-[0.97] transition-transform"
            >
              Add to bag
            </button>
          </div>
        </div>
      </div>
    </StepShell>
  )
}