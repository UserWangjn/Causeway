import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, Newspaper, Radio, Sparkles } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { GenerationEvent, UniverseMarket } from '../types'

type GenerationFlowProps = {
  market: UniverseMarket
  activeStep: number
  events: GenerationEvent[]
}

const steps = [
  'Locking root PM event',
  'Finding related Polymarket markets',
  'Searching news and message flow',
  'Extracting entities and timeline',
  'Scoring causal edges',
  'AI review and script generation',
]

const latestRelated = (events: GenerationEvent[]) =>
  [...events].reverse().find((event) => event.data?.markets?.length)?.data?.markets ?? []

const latestEvidence = (events: GenerationEvent[]) =>
  [...events].reverse().find((event) => event.data?.evidence?.length)?.data?.evidence ?? []

const orbitSlots = [
  { x: -390, y: -260 },
  { x: 390, y: -260 },
  { x: -390, y: 0 },
  { x: 390, y: 0 },
  { x: -390, y: 260 },
  { x: 390, y: 260 },
]

export const GenerationFlow = ({ market, activeStep, events }: GenerationFlowProps) => {
  const relatedMarkets = latestRelated(events)
  const evidence = latestEvidence(events)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!logRef.current) return
    logRef.current.scrollTop = logRef.current.scrollHeight
  }, [events.length])

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

        <div className="generation-live-map">
          {relatedMarkets.slice(0, 6).map((item, index) => (
            <motion.div
              key={item.id}
              className="generation-related-node"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.08 }}
              style={
                {
                  '--node-x': `${orbitSlots[index]?.x ?? 0}px`,
                  '--node-y': `${orbitSlots[index]?.y ?? 0}px`,
                } as CSSProperties
              }
            >
              <strong>{Math.round(item.price * 100)}%</strong>
              <span>{item.question}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <aside className="generation-panel">
        <p className="eyebrow">AI causal assembly</p>
        <h1>Generating market script</h1>
        <p>
          This panel now streams concrete backend work: PM markets discovered, evidence fetched, causal draft size, and
          AI refinement status. Current run has {relatedMarkets.length} related markets and {evidence.length} evidence
          items staged.
        </p>

        <div className="generation-live">
          <div className="generation-live-title">
            <Radio size={16} />
            Live work log
          </div>
          <div className="generation-event-list" ref={logRef}>
            {events.length === 0 && <div className="generation-event">Waiting for backend stream...</div>}
            {events.map((event, index) => (
              <motion.div
                key={`${event.type}-${index}`}
                className={`generation-event generation-event--${event.type}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span>{event.message}</span>
                {event.data?.markets && (
                  <div className="generation-mini-list">
                    {event.data.markets.slice(0, 4).map((item) => (
                      <strong key={item.id}>{item.question}</strong>
                    ))}
                  </div>
                )}
                {event.data?.evidence && (
                  <div className="generation-mini-list">
                    {event.data.evidence.slice(0, 3).map((item) => (
                      <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
                        <Newspaper size={12} />
                        {item.title}
                      </a>
                    ))}
                  </div>
                )}
                {event.type === 'ai' && (
                  <div className="generation-ai-chip">
                    <Sparkles size={13} />
                    {event.data?.aiStatus === 'refined' ? 'AI edge review complete' : 'Calling gpt-5.4-mini'}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

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
