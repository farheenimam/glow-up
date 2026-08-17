import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Landing from './components/Landing.jsx'
import UploadStep from './components/UploadStep.jsx'
import PersonalizeStep from './components/PersonalizeStep.jsx'
import AnalyzingStep from './components/AnalyzingStep.jsx'
import RecommendationsStep from './components/RecommendationsStep.jsx'
import TryOnStep from './components/TryOnStep.jsx'
import CheckoutModal from './components/CheckoutModal.jsx'
import ProgressRail from './components/ProgressRail.jsx'

export const STEPS = ['landing', 'upload', 'personalize', 'analyzing', 'recommendations', 'tryon']

export default function App() {
  const [step, setStep] = useState('landing')
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const [session, setSession] = useState({
    photoUrl: '',
    culture: 'South Asian',
    country: 'Pakistan',
    city: 'Lahore',
    season: 'Monsoon',
    weather: 'Rainy',
    occasion: 'Wedding',
    occasionDetail: 'Barat wedding',
    budget: 'mid',
    heightCm: '155',
    clothingSize: 'M',
    skinToneHex: '#c68863',
    skinProfile: null,
    bodyShape: 'hourglass',
    recommendations: [
      {
        id: 'outfit_1',
        name: 'Emerald raw silk lehenga with zardozi choli',
        rationale: 'This hourglass silhouette is enhanced by a fitted choli and controlled lehenga flare; the emerald raw silk and gold zardozi feel unmistakably festive for a Pakistan Barat while staying elegant for monsoon evenings.',
        matchScore: 96,
        price: 'Rs. 62,500',
        cultureTag: 'Pakistan',
        size: 'M',
        sizeNote: 'Petite-friendly length — you may want a hem taken up.',
        imageUrl: null
      },
      {
        id: 'outfit_2',
        name: 'Bottle green lehenga with sheer dupatta',
        rationale: 'A deep jewel-tone lehenga with a softly draped dupatta and minimal embroidery keeps the look elegant, breathable, and flattering for an hourglass shape in a rainy wedding setting.',
        matchScore: 94,
        price: 'Rs. 58,000',
        cultureTag: 'Pakistan',
        size: 'M',
        sizeNote: 'Petite-friendly length — you may want a hem taken up.',
        imageUrl: null
      },
      {
        id: 'outfit_3',
        name: 'Maroon georgette lehenga with gold gota work',
        rationale: 'The fitted bodice and graceful fall of the georgette lehenga balance a defined waist while the maroon-and-gold gota work feels classic for a Barat event and excellent for a 155 cm frame.',
        matchScore: 92,
        price: 'Rs. 66,000',
        cultureTag: 'Pakistan',
        size: 'M',
        sizeNote: 'Petite-friendly length — you may want a hem taken up.',
        imageUrl: null
      }
    ],
    renderState: {},
    selectedOutfit: null,
    tryOnImageUrl: null
  })

  const patchSession = useCallback((patch) => {
    setSession((prev) => ({ ...prev, ...patch }))
  }, [])

  const goTo = useCallback((next) => setStep(next), [])

  return (
    <div className="relative min-h-screen bg-parchment text-ink font-body overflow-x-hidden">
      <div className="grain-overlay" />
      {step !== 'landing' && <ProgressRail current={step} />}

      <AnimatePresence mode="wait">
        <motion.main
          key={step}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 'landing' && <Landing onStart={() => goTo('upload')} />}

          {step === 'upload' && (
            <UploadStep
              session={session}
              patchSession={patchSession}
              onNext={() => goTo('personalize')}
              onBack={() => goTo('landing')}
            />
          )}

          {step === 'personalize' && (
            <PersonalizeStep
              session={session}
              patchSession={patchSession}
              onNext={() => goTo('analyzing')}
              onBack={() => goTo('upload')}
            />
          )}

          {step === 'analyzing' && (
            <AnalyzingStep
              session={session}
              patchSession={patchSession}
              onComplete={() => goTo('recommendations')}
            />
          )}

          {step === 'recommendations' && (
            <RecommendationsStep
              session={session}
              patchSession={patchSession}
              onSelect={(outfit) => {
                patchSession({ selectedOutfit: outfit, tryOnImageUrl: outfit.tryOnImageUrl || null })
                goTo('tryon')
              }}
              onBack={() => goTo('personalize')}
            />
          )}

          {step === 'tryon' && (
            <TryOnStep
              session={session}
              patchSession={patchSession}
              onBack={() => goTo('recommendations')}
              onCheckout={() => setCheckoutOpen(true)}
            />
          )}
        </motion.main>
      </AnimatePresence>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        outfit={session.selectedOutfit}
      />
    </div>
  )
}