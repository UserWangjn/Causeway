import { motion } from 'framer-motion'
import {
  forceCenter,
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
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

type BubbleNode = SimulationNodeDatum & {
  id: string
  market: UniverseMarket
  radius: number
  cluster: string
  index: number
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
  return Math.max(62, Math.min(118, 54 + Math.log10(volume) * 8))
}

const positionFor = (index: number, width: number, height: number) => {
  const xPercent = 8 + ((index * 37) % 82)
  const yPercent = 14 + ((index * 29) % 70)
  return {
    x: (xPercent / 100) * width,
    y: (yPercent / 100) * height,
  }
}

const clusterTarget = (node: BubbleNode, width: number, height: number) => {
  const clusterIndex = Math.max(0, clusterNames.indexOf(node.cluster))
  const xBand = width / Math.max(1, clusterNames.length)
  const stagger = ((node.index * 31) % 100) / 100

  return {
    x: Math.min(width - node.radius, Math.max(node.radius, xBand * clusterIndex + xBand * 0.5)),
    y: Math.min(height - node.radius, Math.max(node.radius, height * (0.24 + stagger * 0.52))),
  }
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

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
  const simulationRef = useRef<Simulation<BubbleNode, undefined> | null>(null)
  const nodesRef = useRef<BubbleNode[]>([])
  const draggingRef = useRef<string | null>(null)
  const [cloudSize, setCloudSize] = useState({ width: 0, height: 0 })
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
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

  useEffect(() => {
    if (!cloudSize.width || !cloudSize.height || !markets.length) return

    simulationRef.current?.stop()
    const previous = new Map(nodesRef.current.map((node) => [node.id, node]))
    const nodes: BubbleNode[] = markets.map((market, index) => {
      const radius = sizeFor(market) / 2
      const cluster = clusterFor(market)
      const prior = previous.get(market.id)
      const fallback = positionFor(index, cloudSize.width, cloudSize.height)
      return {
        id: market.id,
        market,
        radius,
        cluster,
        index,
        x: prior?.x ?? fallback.x,
        y: prior?.y ?? fallback.y,
        fx: prior?.fx,
        fy: prior?.fy,
      }
    })
    nodesRef.current = nodes

    const simulation = forceSimulation<BubbleNode>(nodes)
      .force('center', forceCenter(cloudSize.width / 2, cloudSize.height / 2))
      .force('charge', forceManyBody<BubbleNode>().strength(-12))
      .force('x', forceX<BubbleNode>((node) => clusterTarget(node, cloudSize.width, cloudSize.height).x).strength(0.08))
      .force('y', forceY<BubbleNode>((node) => clusterTarget(node, cloudSize.width, cloudSize.height).y).strength(0.08))
      .force('collision', forceCollide<BubbleNode>((node) => node.radius + 16).strength(1).iterations(6))
      .alpha(0.9)
      .alphaDecay(0.055)
      .on('tick', () => {
        setNodePositions(
          Object.fromEntries(
            nodes.map((node) => [
              node.id,
              {
                x: clamp(node.x ?? 0, node.radius, cloudSize.width - node.radius),
                y: clamp(node.y ?? 0, node.radius, cloudSize.height - node.radius),
              },
            ]),
          ),
        )
      })

    simulation.tick(90)
    setNodePositions(
      Object.fromEntries(
        nodes.map((node) => [
          node.id,
          {
            x: clamp(node.x ?? 0, node.radius, cloudSize.width - node.radius),
            y: clamp(node.y ?? 0, node.radius, cloudSize.height - node.radius),
          },
        ]),
      ),
    )
    simulation.alpha(0.22).restart()
    simulationRef.current = simulation
    return () => {
      simulation.stop()
    }
  }, [cloudSize.height, cloudSize.width, markets])

  const setDraggedNodePosition = (market: UniverseMarket, clientX: number, clientY: number) => {
    if (!cloudRef.current) return
    const node = nodesRef.current.find((candidate) => candidate.id === market.id)
    if (!node) return

    const rect = cloudRef.current.getBoundingClientRect()
    const x = clamp(clientX - rect.left, node.radius, rect.width - node.radius)
    const y = clamp(clientY - rect.top, node.radius, rect.height - node.radius)
    node.fx = x
    node.fy = y
    node.x = x
    node.y = y
    setNodePositions((current) => ({ ...current, [market.id]: { x, y } }))
    simulationRef.current?.alphaTarget(0.18).restart()
  }

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

        <div className="market-cloud" ref={cloudRef}>
          {markets.map((market, index) => {
            const selected = selectedMarket?.id === market.id
            const size = sizeFor(market)
            const price = Math.round(market.price * 100)
            const position = nodePositions[market.id] ?? positionFor(index, cloudSize.width || 1200, cloudSize.height || 640)
            return (
              <motion.button
                key={market.id}
                type="button"
                className={selected ? 'universe-node universe-node--selected' : 'universe-node'}
                style={{
                  width: size,
                  height: size,
                  left: position.x - size / 2,
                  top: position.y - size / 2,
                  animationDelay: `${(index % 9) * 0.27}s`,
                  zIndex: raisedMarketId === market.id ? 300 : Math.round(180 - size),
                } as CSSProperties}
                onPointerDown={(event) => {
                  draggingRef.current = market.id
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setRaisedMarketId(market.id)
                  onSelect(market)
                  setDraggedNodePosition(market, event.clientX, event.clientY)
                }}
                onPointerMove={(event) => {
                  if (draggingRef.current !== market.id) return
                  setDraggedNodePosition(market, event.clientX, event.clientY)
                }}
                onPointerUp={(event) => {
                  if (draggingRef.current !== market.id) return
                  draggingRef.current = null
                  setRaisedMarketId(null)
                  event.currentTarget.releasePointerCapture(event.pointerId)
                  simulationRef.current?.alphaTarget(0.04)
                }}
                onPointerCancel={() => {
                  draggingRef.current = null
                  setRaisedMarketId(null)
                  simulationRef.current?.alphaTarget(0.04)
                }}
                onClick={() => onSelect(market)}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: selected ? 1.04 : 1 }}
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
            <div className="universe-legend universe-legend--panel">
              <span>Drag nodes to reorganize</span>
              <span>Bubble size = log market volume</span>
              <span>Collision keeps bubbles readable</span>
              <span>Number = YES probability</span>
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
