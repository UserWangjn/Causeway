import { useMemo } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { MarketNode, type MarketNodeData } from './MarketNode'
import { CausalEdge, type CausalEdgeData } from './CausalEdge'
import type { GraphEdge, GraphNode, ImpactDirection, ScenarioPreset } from '../types'

const nodeTypes = {
  marketNode: MarketNode,
}

const edgeTypes = {
  causalEdge: CausalEdge,
}

type ScenarioGraphProps = {
  scenario: ScenarioPreset
}

const getDeltaForNode = (
  nodeId: string,
  activeEdges: GraphEdge[],
): { delta?: [number, number]; direction?: ImpactDirection } => {
  const edge = activeEdges.find((candidate) => candidate.target === nodeId)
  return edge ? { delta: edge.deltaRange, direction: edge.direction } : {}
}

const getStablePosition = (node: GraphNode, index: number, scenario: ScenarioPreset) => {
  if (node.id === scenario.rootNodeId) {
    return { x: 0, y: 260 }
  }

  const incoming = scenario.edges.find((edge) => edge.target === node.id)
  const level = incoming?.source === scenario.rootNodeId ? 1 : 2
  const levelNodes = scenario.nodes.filter((candidate) => {
    if (candidate.id === scenario.rootNodeId) return false
    const candidateIncoming = scenario.edges.find((edge) => edge.target === candidate.id)
    return level === 1 ? candidateIncoming?.source === scenario.rootNodeId : candidateIncoming?.source !== scenario.rootNodeId
  })
  const levelIndex = Math.max(0, levelNodes.findIndex((candidate) => candidate.id === node.id))
  const slots = level === 1 ? [80, 260, 440, 620] : [140, 320, 500, 680]

  return {
    x: level * 390,
    y: slots[levelIndex % slots.length] + Math.floor(levelIndex / slots.length) * 150 + index * 0.01,
  }
}

export const ScenarioGraph = ({ scenario }: ScenarioGraphProps) => {
  const activeEdges = scenario.edges

  const nodes = useMemo<Node<MarketNodeData>[]>(() => {
    return scenario.nodes.map((node, index) => {
      const { delta, direction } = getDeltaForNode(node.id, activeEdges)
      return {
        id: node.id,
        type: 'marketNode',
        position: getStablePosition(node, index, scenario),
        data: {
          ...node,
          status: node.id === scenario.rootNodeId ? 'active' : 'impacted',
          delta,
          direction,
          isRoot: node.id === scenario.rootNodeId,
          onActivate: () => undefined,
        },
      }
    })
  }, [activeEdges, scenario])

  const edges = useMemo<Edge<CausalEdgeData>[]>(() => {
    return scenario.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'causalEdge',
      animated: false,
      data: {
        ...edge,
        active: true,
      },
    }))
  }, [scenario.edges])

  return (
    <ReactFlowProvider>
      <div className="graph-shell">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 0.95 }}
          minZoom={0.35}
          maxZoom={1.35}
          nodesDraggable
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#273244" gap={28} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}
