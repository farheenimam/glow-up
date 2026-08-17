import StepShell from './StepShell.jsx'

const OCCASIONS = ['Casual', 'Office', 'Party', 'Wedding', 'Festive / Religious', 'Date night']
const BUDGETS = [
  { key: 'low', label: 'Budget-friendly' },
  { key: 'mid', label: 'Mid-range' },
  { key: 'high', label: 'Splurge' }
]
const BODY_SHAPES = [
  { key: 'pear', label: 'Pear' },
  { key: 'apple', label: 'Apple' },
  { key: 'hourglass', label: 'Hourglass' },
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'inverted_triangle', label: 'Inverted triangle' }
]
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const CULTURES = [
  'South Asian',
  'West African',
  'East African',
  'North African',
  'Middle Eastern',
  'East Asian',
  'Southeast Asian',
  'Western contemporary',
  'Latin American',
  'Eastern European',
  'Other'
]

const COUNTRIES = [
  'Pakistan',
  'India',
  'United Arab Emirates',
  'Saudi Arabia',
  'Bangladesh',
  'United Kingdom',
  'United States',
  'Canada',
  'Other'
]

const CITIES_BY_COUNTRY = {
  Pakistan: [
    'Karachi',
    'Lahore',
    'Islamabad',
    'Rawalpindi',
    'Faisalabad',
    'Multan',
    'Peshawar',
    'Quetta',
    'Hyderabad',
    'Sialkot',
    'Gujranwala',
    'Sukkur'
  ],
  India: [
    'Mumbai',
    'Delhi',
    'Bengaluru',
    'Hyderabad',
    'Chennai',
    'Kolkata',
    'Pune',
    'Ahmedabad',
    'Jaipur',
    'Lucknow'
  ],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar'],
  Bangladesh: ['Dhaka', 'Chittagong', 'Khulna', 'Rajshahi', 'Sylhet'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool'],
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'San Francisco', 'Miami'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa']
}

const SEASONS = ['Summer', 'Monsoon', 'Autumn', 'Winter', 'Spring']

const WEATHER_OPTIONS = ['Hot & Sunny', 'Humid', 'Mild / Pleasant', 'Cloudy', 'Rainy', 'Cold']

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block font-medium mb-1">
        {label} <span className="text-clay">*</span>
      </label>
      {hint && <p className="text-sm text-ink/50 mb-3">{hint}</p>}
      {children}
    </div>
  )
}

function PillGroup({ options, value, onChange, getKey = (o) => o, getLabel = (o) => o }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const key = getKey(opt)
        const active = value === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-4 py-2 rounded-full text-sm border transition-colors ${
              active
                ? 'bg-ink text-parchment border-ink'
                : 'border-ink/20 text-graphite hover:border-ink/50'
            }`}
          >
            {getLabel(opt)}
          </button>
        )
      })}
    </div>
  )
}

export default function PersonalizeStep({ session, patchSession, onNext, onBack }) {
  const canContinue =
    session.culture.trim().length > 0 &&
    session.country.trim().length > 0 &&
    session.city.trim().length > 0 &&
    session.season.trim().length > 0 &&
    session.weather.trim().length > 0 &&
    Boolean(session.bodyShape) &&
    session.heightCm !== '' &&
    Boolean(session.clothingSize) &&
    session.occasion.trim().length > 0 &&
    session.occasionDetail.trim().length > 0 &&
    Boolean(session.budget)

  const citiesForCountry = CITIES_BY_COUNTRY[session.country]

  return (
    <StepShell
      eyebrow="Step 02"
      title="Style is never one-size-fits-all"
      subtitle="These answers let the recommendation engine fit your cultural context, climate, and the moment you're dressing for — including your body shape, which we ask directly."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!canContinue}
      nextLabel="Read my skin →"
    >
      <div className="grid md:grid-cols-2 gap-x-12 gap-y-10 max-w-3xl">
        <Field
          label="Your culture or style tradition"
          hint="Shapes the silhouettes, modesty level, and fabrics we suggest."
        >
          <select
            value={CULTURES.includes(session.culture) ? session.culture : session.culture ? 'Other' : ''}
            onChange={(e) => patchSession({ culture: e.target.value === 'Other' ? '' : e.target.value })}
            className="w-full bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-lg transition-colors"
          >
            <option value="" disabled>
              Select a culture or style tradition
            </option>
            {CULTURES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {!CULTURES.includes(session.culture) && (
            <input
              type="text"
              value={session.culture}
              onChange={(e) => patchSession({ culture: e.target.value })}
              placeholder="Tell us your culture or style tradition"
              className="w-full mt-3 bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-lg transition-colors"
            />
          )}
        </Field>

        <Field
          label="Country you're dressing for"
          hint="Drives the makeup recommendations — humidity, sun intensity, and climate change what actually holds up on skin."
        >
          <select
            value={session.country}
            onChange={(e) =>
              patchSession({
                country: e.target.value,
                // Reset city whenever the country changes so we never carry
                // a city that doesn't belong to the newly selected country.
                city: ''
              })
            }
            className="w-full bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-lg transition-colors"
          >
            <option value="" disabled>
              Select a country
            </option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="City"
          hint={
            citiesForCountry
              ? 'Helps fine-tune climate specifics beyond just the country.'
              : 'Type the city you\u2019re dressing for.'
          }
        >
          {citiesForCountry ? (
            <select
              value={session.city}
              onChange={(e) => patchSession({ city: e.target.value })}
              className="w-full bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-lg transition-colors"
            >
              <option value="" disabled>
                Select a city
              </option>
              {citiesForCountry.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={session.city}
              onChange={(e) => patchSession({ city: e.target.value })}
              placeholder="e.g. your city"
              className="w-full bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-lg transition-colors"
            />
          )}
        </Field>

        <Field label="Season you're dressing for">
          <PillGroup
            options={SEASONS}
            value={session.season}
            onChange={(v) => patchSession({ season: v })}
          />
        </Field>

        <Field label="Current weather">
          <PillGroup
            options={WEATHER_OPTIONS}
            value={session.weather}
            onChange={(v) => patchSession({ weather: v })}
          />
        </Field>

        <Field
          label="Your skin tone"
          hint="Drag the picker to the closest match — this is the color-matching signal the styling agents use."
        >
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={session.skinToneHex}
              onChange={(e) => patchSession({ skinToneHex: e.target.value })}
              className="w-14 h-14 rounded-full border border-ink/20 cursor-pointer bg-transparent p-0"
            />
            <span className="font-mono text-sm text-ink/60 uppercase">{session.skinToneHex}</span>
          </div>
        </Field>

        <Field
          label="Your body shape"
          hint="This drives the silhouettes we suggest."
        >
          <PillGroup
            options={BODY_SHAPES}
            value={session.bodyShape}
            onChange={(v) => patchSession({ bodyShape: v })}
            getKey={(s) => s.key}
            getLabel={(s) => s.label}
          />
        </Field>

        <Field
          label="Your height (cm)"
          hint="We don't guess body measurements from this — it's only used for a simple, honest length note (petite vs. tall cut), never a fabricated 'perfect fit' claim."
        >
          <input
            type="number"
            min="120"
            max="220"
            value={session.heightCm}
            onChange={(e) => patchSession({ heightCm: e.target.value })}
            placeholder="e.g. 165"
            className="w-full bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-lg transition-colors"
          />
        </Field>

        <Field
          label="Your usual clothing size"
          hint="Whatever size you normally wear in this category — we echo it back on your picks, we don't override it."
        >
          <PillGroup options={SIZES} value={session.clothingSize} onChange={(v) => patchSession({ clothingSize: v })} />
        </Field>

        <Field label="Occasion" hint="What are you dressing for?">
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => {
              const value = occ.toLowerCase()
              const active = session.occasion === value
              return (
                <button
                  key={occ}
                  onClick={() => patchSession({ occasion: value })}
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    active
                      ? 'bg-ink text-parchment border-ink'
                      : 'border-ink/20 text-graphite hover:border-ink/50'
                  }`}
                >
                  {occ}
                </button>
              )
            })}
          </div>
          {session.occasion && (
            <textarea
              value={session.occasionDetail}
              onChange={(e) => patchSession({ occasionDetail: e.target.value })}
              placeholder="Tell us more about the event in your own words \u2014 e.g. \u201cmy cousin's mehndi, outdoor evening, I want to stand out but not outshine the bride\u201d"
              rows={3}
              className="w-full mt-3 bg-transparent border-b-2 border-ink/20 focus:border-clay outline-none py-2 text-base transition-colors resize-none"
            />
          )}
        </Field>

        <Field label="Budget">
          <div className="flex gap-2">
            {BUDGETS.map((b) => {
              const active = session.budget === b.key
              return (
                <button
                  key={b.key}
                  onClick={() => patchSession({ budget: b.key })}
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    active
                      ? 'bg-clay text-parchment border-clay'
                      : 'border-ink/20 text-graphite hover:border-ink/50'
                  }`}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        </Field>
      </div>
    </StepShell>
  )
}
