import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import clsx from 'clsx'
import { uiText } from '../i18n'
import { useScenarioStore } from '../store/scenarioStore'
import type { GraphEdge } from '../types'

export type CausalEdgeData = GraphEdge & {
  active: boolean
}

export type CausalFlowEdge = Edge<CausalEdgeData, 'causalEdge'>

const strokeFor = (direction: GraphEdge['direction']) => {
  if (direction === 'up') return '#4c8dff'
  if (direction === 'down') return '#f05252'
  return '#d6a73a'
}

const widthFor = (strength: GraphEdge['strength']) => {
  if (strength === 'strong') return 4
  if (strength === 'medium') return 3
  return 2
}

export const CausalEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<CausalFlowEdge>) => {
  const language = useScenarioStore((state) => state.language)
  const text = uiText[language]
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  if (!data) return null

  const stroke = strokeFor(data.direction)
  const opacity = data.active ? Math.max(0.42, data.confidence) : 0.18
  const high = data.deltaRange[1]
  const label =
    data.direction === 'uncertain' ? text.mixed : `${high > 0 ? '+' : ''}${Math.round(high * 100)} ${text.points}`

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={clsx('causal-edge-path', { 'causal-edge-path--active': data.active })}
        style={{
          stroke,
          opacity,
          strokeWidth: widthFor(data.strength),
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={clsx('edge-label', { 'edge-label--active': data.active })}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: stroke,
          }}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
