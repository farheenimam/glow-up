import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createCheckoutSession } from '../lib/api.js'

export default function CheckoutModal({ open, onClose, outfit }) {
  const [state, setState] = useState('idle') // idle | processing | done
  const [form, setForm] = useState({ name: '', email: '', address: '' })

  if (!outfit) return null

  async function handlePay(e) {
    e.preventDefault()
    setState('processing')
    try {
      // Backend clearly labels this a mock session — see backend/routes/checkout.js.
      await createCheckoutSession({ items: [{ id: outfit.id, name: outfit.name, price: outfit.price }] })
    } finally {
      setTimeout(() => setState('done'), 900)
    }
  }

  function handleClose() {
    setState('idle')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="bg-parchment rounded-[1.5rem] max-w-md w-full p-8 shadow-editorial relative"
          >
            <button onClick={handleClose} className="absolute top-5 right-5 text-ink/40 hover:text-ink">✕</button>

            {state !== 'done' ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-widest text-clay mb-2">Mock checkout — demo only</p>
                <h3 className="font-display text-2xl mb-6">{outfit.name}</h3>
                <div className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-3 mb-6 border border-ink/10">
                  <span className="text-sm text-graphite/70">Total</span>
                  <span className="font-mono text-clay">{outfit.price}</span>
                </div>
                <form onSubmit={handlePay} className="space-y-4">
                  <input
                    required
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-white/70 border border-ink/15 rounded-xl px-4 py-3 outline-none focus:border-clay"
                  />
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-white/70 border border-ink/15 rounded-xl px-4 py-3 outline-none focus:border-clay"
                  />
                  <input
                    required
                    placeholder="Shipping address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-white/70 border border-ink/15 rounded-xl px-4 py-3 outline-none focus:border-clay"
                  />
                  <button
                    type="submit"
                    disabled={state === 'processing'}
                    className="w-full bg-ink text-parchment py-3.5 rounded-full font-medium disabled:opacity-50"
                  >
                    {state === 'processing' ? 'Processing…' : `Pay ${outfit.price} (mock)`}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-moss/15 flex items-center justify-center text-moss text-2xl">✓</div>
                <h3 className="font-display text-2xl mb-2">Order confirmed</h3>
                <p className="text-graphite/70 mb-6">{outfit.name} — {outfit.price}. This is a demo confirmation, no charge was made.</p>
                <button onClick={handleClose} className="bg-ink text-parchment px-6 py-3 rounded-full text-sm font-medium">
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
