import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import skinRoutes from './routes/skin.js'
import recommendationsRoutes from './routes/recommendations.js'
import vtoRoutes from './routes/vto.js'
import checkoutRoutes from './routes/checkout.js'

const app = express()
const PORT = process.env.PORT || 8787
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

// --- Security baseline ---------------------------------------------------
// 1. helmet: sane security headers by default (HSTS, no-sniff, frameguard…)
app.use(helmet())

// 2. CORS locked to the one frontend origin — no wildcard, no reflected
// origin. Update FRONTEND_ORIGIN in .env when you deploy.
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: false }))

// 3. Rate limiting on the API surface — cheap protection against a runaway
// client or someone hammering the (paid, metered) YouCam/Hyper3D calls.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests — please slow down.' }
  })
)

// A tighter limit on the two expensive, external-API-calling routes.
const expensiveLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many generation requests — please wait a few minutes.' }
})

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/skin', expensiveLimiter, skinRoutes)
app.use('/api/recommendations', recommendationsRoutes)
app.use('/api/vto', expensiveLimiter, vtoRoutes)
app.use('/api/checkout', checkoutRoutes)

// Central error handler — never leak stack traces or raw upstream error
// bodies (which could contain the API key in a request echo) to the client.
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: 'Something went wrong on our end.' })
})

app.listen(PORT, () => {
  console.log(`GlowMatch backend listening on http://localhost:${PORT}`)
})