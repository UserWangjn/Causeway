import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { uiText } from '../i18n'
import { useScenarioStore } from '../store/scenarioStore'
import type { GraphNode, ImpactDirection, NodeStatus } from '../types'

export type MarketNodeData = GraphNode & {
  delta?: [number, number]
  direction?: ImpactDirection
  isRoot?: boolean
  onActivate: (nodeId: string) => void
}

export type MarketFlowNode = Node<MarketNodeData, 'marketNode'>

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const formatDelta = (delta: [number, number] | undefined, text: { base: string; to: string; points: string }) => {
  if (!delta) return text.base
  const [low, high] = delta
  const sign = high >= 0 ? '+' : ''
  return `${sign}${Math.round(low * 100)} ${text.to} ${sign}${Math.round(high * 100)} ${text.points}`
}

export const MarketNode = memo(({ data }: NodeProps<MarketFlowNode>) => {
  const language = useScenarioStore((state) => state.language)
  const text = uiText[language]
  const statusLabel: Record<NodeStatus, string> = text.status
  const isDown = data.direction === 'down'
  const isUncertain = data.direction === 'uncertain'

  return (
    <motion.button
      type="button"
      onClick={() => data.onActivate(data.id)}
      className={clsx('market-node', {
        'market-node--active': data.status === 'active',
        'market-node--impacted': data.status === 'impacted',
        'market-node--muted': data.status === 'muted',
        'market-node--root': data.isRoot,
        'market-node--down': isDown,
        'market-node--uncertain': isUncertain,
      })}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{
        opacity: data.status === 'muted' ? 0.42 : 1,
        y: 0,
        scale: data.status === 'active' ? 1.04 : 1,
      }}
      transition={{ duration: 0.35 }}
    >
      <Handle className="node-handle" type="target" position={Position.Left} />
      <div className="node-topline">
        <span className="node-category">{data.category}</span>
        <span className="node-status">{statusLabel[data.status]}</span>
      </div>
      <div className="node-question">{data.question}</div>
      <div className="node-bottom">
        <span className="node-outcome">{data.outcome}</span>
        <span className="node-price">{formatPercent(data.price)}</span>
        <span className="node-delta">{formatDelta(data.delta, text)}</span>
      </div>
      {typeof data.volume === 'number' && (
        <div className="node-volume">
          ${(data.volume / 1000000).toFixed(1)}M {text.volume}
        </div>
      )}
      <Handle className="node-handle" type="source" position={Position.Right} />
    </motion.button>
  )
})
