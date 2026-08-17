import axios from 'axios'

// The browser NEVER sees YouCam, Gemini, Anthropic, or Hyper3D keys. Every
// call goes through our own backend (see /backend/routes), which attaches
// the real keys server-side. Photos are passed as a public URL the user
// supplies (see UploadStep.jsx) rather than uploaded as a file, so the
// backend never needs to be publicly reachable to serve them back out.
const client = axios.create({
  baseURL: '/api',
  timeout: 120000
})

function clean(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

export async function analyzeSkin({ photoUrl }) {
  const { data } = await client.post('/skin/analyze', clean({ photoUrl }))
  return data
}

export async function getRecommendations({
  photoUrl,
  bodyShape,
  skinProfile,
  skinToneHex,
  culture,
  country,
  city,
  season,
  weather,
  occasion,
  occasionDetail,
  budget,
  heightCm,
  clothingSize
}) {
  const { data } = await client.post(
    '/recommendations',
    clean({
      photoUrl,
      bodyShape,
      culture,
      country,
      city,
      season,
      weather,
      occasion,
      occasionDetail,
      budget,
      heightCm,
      clothingSize,
      skinToneHex,
      skinProfile: skinProfile ? JSON.stringify(skinProfile) : undefined
    })
  )
  return data
}

export async function generateTryOn({ photoUrl, outfit, occasion, occasionDetail, season, weather, culture, country, keyIndex }) {
  const { data } = await client.post(
    '/vto/generate',
    clean({
      photoUrl,
      occasion,
      occasionDetail,
      season,
      weather,
      culture,
      country,
      keyIndex,
      outfit: outfit ? JSON.stringify(outfit) : undefined
    })
  )
  return data
}

export async function createCheckoutSession({ items }) {
  const { data } = await client.post('/checkout/session', { items })
  return data
}