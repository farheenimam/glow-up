import { motion } from 'framer-motion'
import HeroOutfitShowcase from './HeroOutfitShowcase.jsx'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.09, duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  })
}

export default function Landing({ onStart }) {
  return (
    <div className="relative">
      <nav className="absolute top-0 left-0 right-0 z-20 max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <span className="font-display italic text-xl">GlowMatch</span>
        <span className="font-mono text-[11px] tracking-widest uppercase text-ink/50">
          Built on YouCam API · Skin AI + Apparel VTO
        </span>
      </nav>

      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* decorative diagonal field */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-24 -right-40 w-[560px] h-[560px] rounded-full bg-clay/20 blur-3xl" />
          <div className="absolute bottom-0 left-[-10%] w-[420px] h-[420px] rounded-full bg-moss/20 blur-3xl" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="diagonal" width="42" height="42" patternTransform="rotate(28)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="42" stroke="#1b1712" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#diagonal)" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-28 pb-20 grid md:grid-cols-[1.3fr_1fr] gap-16 items-center w-full">
          <div>
            <motion.p
              variants={fadeUp} initial="hidden" animate="show" custom={0}
              className="font-mono text-xs tracking-[0.25em] uppercase text-clay mb-6"
            >
              One photo. Your skin. Your culture. Your fit.
            </motion.p>

            <motion.h1
              variants={fadeUp} initial="hidden" animate="show" custom={1}
              className="font-display text-[13vw] md:text-[6.2vw] leading-[0.95] tracking-tight mb-8"
            >
              See yourself
              <br />
              <span className="italic text-clay">styled,</span> before
              <br />
              you buy a thread.
            </motion.h1>

            <motion.p
              variants={fadeUp} initial="hidden" animate="show" custom={2}
              className="max-w-md text-lg text-graphite/80 mb-10 leading-relaxed"
            >
              Upload one photo. GlowMatch reads your skin tone and body shape,
              curates outfits and makeup tuned to your culture and your
              climate — then renders <em className="font-display italic">you</em>,
              not a stand-in model, trying it on in full 3D.
            </motion.p>

            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="flex items-center gap-5">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onStart}
                className="bg-ink text-parchment px-8 py-4 rounded-full font-medium tracking-wide shadow-editorial"
              >
                Upload your photo →
              </motion.button>
              <span className="font-mono text-[11px] text-ink/40">no signup · ~90 seconds</span>
            </motion.div>
          </div>

          <div>
            <motion.div
              variants={fadeUp} initial="hidden" animate="show" custom={2}
              className="relative aspect-[3/4] rounded-[2rem] bg-gradient-to-br from-sand to-clay/10 border border-ink/10 shadow-editorial overflow-hidden"
            >
              <HeroOutfitShowcase />
            </motion.div>
            <p className="mt-3 font-mono text-[10px] text-ink/35 text-right">
              Stylized 3D preview, drag to rotate — your actual likeness renders after upload, via YouCam Apparel VTO + Hyper3D.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-28 grid md:grid-cols-3 gap-8">
        {[
          {
            n: '01',
            title: 'Skin AI reads you',
            body: 'Undertone, texture and tone lifted straight from your photo via YouCam Skin AI — the same engine behind 800+ beauty brands.'
          },
          {
            n: '02',
            title: 'Culture + climate aware',
            body: 'Tell us your culture and country. Outfit picks respect what you actually wear; makeup picks respect your actual weather.'
          },
          {
            n: '03',
            title: 'Try it on as you, in 3D',
            body: 'Apparel VTO renders the outfit on your photo instantly. Then we build a 3D avatar carrying your own likeness to walk around.'
          }
        ].map((f, i) => (
          <motion.div
            key={f.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="border-t border-ink/15 pt-6"
          >
            <span className="font-display italic text-clay text-2xl">{f.n}</span>
            <h3 className="font-display text-2xl mt-2 mb-3">{f.title}</h3>
            <p className="text-graphite/75 leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </section>
    </div>
  )
}
