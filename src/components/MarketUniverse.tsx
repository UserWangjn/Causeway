import { motion } from 'framer-motion'
import { Activity, Loader2, Network, Play } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  return Math.max(74, Math.min(148, 62 + Math.log10(volume) * 10))
}

const positionFor = (index: number, width: number, height: number) => {
  const xPercent = 8 + ((index * 37) % 82)
  const yPercent = 14 + ((index * 29) % 70)
  return {
    x: (xPercent / 100) * width,
    y: (yPercent / 100) * height,
  }
}

const formatVolume = (volume: number) => {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`
  return `$${Math.round(volume)}`
}

export const MarketUniverse = ({
  markets,
  selectedMarket,
  loading,
  error,
  onSelect,
  onGenerate,
}: MarketUniverseProps) => {
  const cloudRef = useRef<HTMLDivElement>(null)
  const [cloudSize, setCloudSize] = useState({ width: 0, height: 0 })
  const [draggedPositions, setDraggedPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [raisedMarketId, setRaisedMarketId] = useState<string | null>(null)

  useEffect(() => {
    if (!cloudRef.current) return
    const update = () => {
      if (!cloudRef.current) return
      const rect = cloudRef.current.getBoundingClientRect()
      setCloudSize({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(cloudRef.current)
    return () => observer.disconnect()
  }, [])

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

        <div className="universe-legend">
          <span>Drag nodes to reorganize</span>
          <span>Bubble size = log market volume</span>
          <span>Number = YES probability</span>
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

        <div className="market-cloud" ref={cloudRef}>
          {markets.map((market, index) => {
            const selected = selectedMarket?.id === market.id
            const size = sizeFor(market)
            const price = Math.round(market.price * 100)
            const position =
              draggedPositions[market.id] ?? positionFor(index, cloudSize.width || 1200, cloudSize.height || 640)
            return (
              <motion.button
                key={market.id}
                type="button"
                className={selected ? 'universe-node universe-node--selected' : 'universe-node'}
                style={{
                  width: size,
                  height: size,
                  x: position.x - size / 2,
                  y: position.y - size / 2,
                  animationDelay: `${(index % 9) * 0.27}s`,
                  zIndex: raisedMarketId === market.id ? 30 : selected ? 20 : 1,
                } as CSSProperties}
                onPointerDown={() => {
                  setRaisedMarketId(market.id)
                  onSelect(market)
                }}
                onClick={() => onSelect(market)}
                drag
                dragConstraints={cloudRef}
                dragElastic={0.08}
                dragMomentum={false}
                whileDrag={{ scale: 1.1 }}
                onDragEnd={(event) => {
                  if (!cloudRef.current) return
                  const nodeRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                  const cloudRect = cloudRef.current.getBoundingClientRect()
                  setDraggedPositions((current) => ({
                    ...current,
                    [market.id]: {
                      x: nodeRect.left - cloudRect.left + nodeRect.width / 2,
                      y: nodeRect.top - cloudRect.top + nodeRect.height / 2,
                    },
                  }))
                }}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: selected ? 1.12 : 1 }}
                transition={{ delay: index * 0.018, duration: 0.36 }}
              >
                <span className="universe-node-price">{price}%</span>
                <span className="universe-node-question">{market.question}</span>
                <span className="universe-node-volume">{formatVolume(market.volume)}</span>
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
            <div className="root-size-note">
              Current bubble diameter: {Math.round(sizeFor(selectedMarket))}px, derived from log market volume (
              {formatVolume(selectedMarket.volume)}).
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
