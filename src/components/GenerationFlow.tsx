import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { UniverseMarket } from '../types'

type GenerationFlowProps = {
  market: UniverseMarket
  activeStep: number
}

const steps = [
  'Locking root PM event',
  'Finding related Polymarket markets',
  'Searching news and message flow',
  'Extracting entities and timeline',
  'Scoring causal edges',
  'Skeptic review and script generation',
]

export const GenerationFlow = ({ market, activeStep }: GenerationFlowProps) => {
  return (
    <section className="generation-screen">
      <div className="generation-core">
        <motion.div
          className="generation-root"
          animate={{ scale: [1, 1.05, 1], boxShadow: ['0 0 0 rgba(32,229,143,0)', '0 0 70px rgba(32,229,143,0.28)', '0 0 0 rgba(32,229,143,0)'] }}
          transition={{ repeat: Infinity, duration: 1.7 }}
        >
          <span>{Math.round(market.price * 100)}%</span>
          <strong>{market.question}</strong>
        </motion.div>

        <div className="generation-orbits" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <aside className="generation-panel">
        <p className="eyebrow">AI causal assembly</p>
        <h1>Generating market script</h1>
        <p>
          The selected root is being expanded into related markets, evidence, causal edges, confidence scores, and a
          playable scenario.
        </p>
        <div className="generation-steps">
          {steps.map((step, index) => {
            const done = index < activeStep
            const active = index === activeStep
            return (
              <motion.div
                key={step}
                className={active ? 'generation-step generation-step--active' : done ? 'generation-step generation-step--done' : 'generation-step'}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {done ? <CheckCircle2 size={17} /> : active ? <Loader2 className="spin" size={17} /> : <span />}
                {step}
              </motion.div>
            )
          })}
        </div>
      </aside>
    </section>
  )
}
