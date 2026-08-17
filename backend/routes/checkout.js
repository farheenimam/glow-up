import { Router } from 'express'
import { v4 as uuid } from 'uuid'

const router = Router()

// Demo-only mock checkout — deliberately does not integrate a real payment
// processor. Swap in Stripe (or similar) here if this ever needs to take
// real payments; keep the secret key server-side exactly like this file does.
router.post('/session', (req, res) => {
  const { items } = req.body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one item is required.' })
  }

  res.json({
    sessionId: `mock_${uuid()}`,
    status: 'confirmed',
    items
  })
})

export default router
