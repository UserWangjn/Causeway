import { motion } from 'framer-motion'
import { Activity, Loader2, Network, Play } from 'lucide-react'
import type { UniverseMarket } from '../types'

type MarketUniverseProps = {
  markets: UniverseMarket[]
  selectedMarket?: UniverseMarket
  loading: boolean
  error?: string | null
  onSelect: (market: UniverseMarket) => void
  onGenerate: () => void
}

const clusterNames = ['Politics', 'Crypto', 'Macro', 'Geopolitics', 'AI', 'Sports']

const clusterFor = (market: UniverseMarket) => {
  const text = `${market.question} ${market.category} ${market.eventTitle ?? ''}`.toLowerCase()
  if (text.includes('bitcoin') || text.includes('crypto') || text.includes('ethereum')) return 'Crypto'
  if (text.includes('fed') || text.includes('inflation') || text.includes('rate') || text.includes('recession'))
    return 'Macro'
  if (text.includes('china') || text.includes('taiwan') || text.includes('ukraine') || text.includes('iran'))
    return 'Geopolitics'
  if (text.includes('ai') || text.includes('openai') || text.includes('model')) return 'AI'
  if (text.includes('cup') || text.includes('nba') || text.includes('nhl')) return 'Sports'
  return 'Politics'
}

const sizeFor = (market: UniverseMarket) => {
  const volume = Math.max(1, market.volume)
  return Math.max(82, Math.min(138, 66 + Math.log10(volume) * 10))
}

const positionFor = (index: number) => {
  const x = 8 + ((index * 37) % 82)
  const y = 14 + ((index * 29) % 70)
  return {
    left: `${x}%`,
    top: `${y}%`,
  }
}

export const MarketUniverse = ({
  markets,
  selectedMarket,
  loading,
  error,
  onSelect,
  onGenerate,
}: MarketUniverseProps) => {
  return (
    <section className="universe">
      <div className="universe-stage">
        <div className="universe-header">
          <p className="eyebrow">Realtime Polymarket universe</p>
          <h1>Choose a live market event to generate a causal script</h1>
          <p>
            Live PM nodes pulse by price and volume. Select one root event, then let AI search related markets, news,
            and evidence to assemble the causal run.
          </p>
        </div>

        <div className="cluster-ring" aria-hidden="true">
          {clusterNames.map((cluster, index) => (
            <span key={cluster} style={{ transform: `rotate(${index * 60}deg) translateX(42vw) rotate(-${index * 60}deg)` }}>
              {cluster}
            </span>
          ))}
        </div>

        {loading && (
          <div className="universe-loading">
            <Loader2 className="spin" size={22} />
            Loading live PM markets
          </div>
        )}

        {error && <div className="universe-error">{error}</div>}

        <div className="market-cloud">
          {markets.map((market, index) => {
            const selected = selectedMarket?.id === market.id
            const size = sizeFor(market)
            const price = Math.round(market.price * 100)
            return (
              <motion.button
                key={market.id}
                type="button"
                className={selected ? 'universe-node universe-node--selected' : 'universe-node'}
                style={{
                  ...positionFor(index),
                  width: size,
                  height: size,
                  animationDelay: `${(index % 9) * 0.27}s`,
                }}
                onClick={() => onSelect(market)}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: selected ? 1.12 : 1 }}
                transition={{ delay: index * 0.018, duration: 0.36 }}
              >
                <span className="universe-node-price">{price}%</span>
                <span className="universe-node-question">{market.question}</span>
                <span className={`universe-node-cluster universe-node-cluster--${clusterFor(market).toLowerCase()}`}>
                  {clusterFor(market)}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      <aside className="root-inspector">
        <div className="root-inspector-title">
          <Network size={18} />
          Root event
        </div>
        {selectedMarket ? (
          <>
            <h2>{selectedMarket.question}</h2>
            <div className="root-stats">
              <span>
                <strong>{Math.round(selectedMarket.price * 100)}%</strong>
                YES
              </span>
              <span>
                <strong>${(selectedMarket.volume / 1000000).toFixed(1)}M</strong>
                volume
              </span>
              <span>
                <strong>{selectedMarket.category}</strong>
                category
              </span>
            </div>
            <p>
              Start a run to pull related PM markets, search current news, and let the agent chain assemble a causal
              script from this root event.
            </p>
            <button className="generate-button" type="button" onClick={onGenerate}>
              <Play size={18} />
              Start causal generation
            </button>
          </>
        ) : (
          <div className="root-empty">
            <Activity size={22} />
            Select a pulsing PM market node to begin.
          </div>
        )}
      </aside>
    </section>
  )
}
