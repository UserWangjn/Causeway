import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { layoutGraph } from '../utils/layout'
import { useScenarioStore } from '../store/scenarioStore'
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

const buildNodeStatus = (
  node: GraphNode,
  scenario: ScenarioPreset,
  activeStepIndex: number,
) => {
  const currentStep = scenario.steps[activeStepIndex]
  const completedSteps = scenario.steps.slice(0, activeStepIndex + 1)
  const impacted = new Set(completedSteps.flatMap((step) => step.impactedNodeIds))

  if (currentStep?.sourceNodeId === node.id || (activeStepIndex === -1 && node.id === scenario.rootNodeId)) {
    return 'active'
  }
  if (impacted.has(node.id)) return 'impacted'
  if (activeStepIndex >= 0) return 'muted'
  return 'idle'
}

export const ScenarioGraph = ({ scenario }: ScenarioGraphProps) => {
  const activeStepIndex = useScenarioStore((state) => state.activeStepIndex)
  const setStep = useScenarioStore((state) => state.setStep)
  const play = useScenarioStore((state) => state.play)
  const [laidOutNodes, setLaidOutNodes] = useState<Node<MarketNodeData>[]>([])

  const activeEdgeIds = useMemo(
    () => new Set(scenario.steps.slice(0, activeStepIndex + 1).flatMap((step) => step.edgeIds)),
    [activeStepIndex, scenario],
  )

  const activeEdges = useMemo(
    () => scenario.edges.filter((edge) => activeEdgeIds.has(edge.id)),
    [activeEdgeIds, scenario.edges],
  )

  const activateFromNode = useCallback(
    (nodeId: string) => {
      const nextStepIndex = scenario.steps.findIndex(
        (step) => step.sourceNodeId === nodeId || step.impactedNodeIds.includes(nodeId),
      )
      setStep(nextStepIndex > -1 ? nextStepIndex - 1 : -1)
      play()
    },
    [play, scenario.steps, setStep],
  )

  const nodes = useMemo<Node<MarketNodeData>[]>(() => {
    return scenario.nodes.map((node, index) => {
      const { delta, direction } = getDeltaForNode(node.id, activeEdges)
      return {
        id: node.id,
        type: 'marketNode',
        position: { x: (index % 3) * 360, y: Math.floor(index / 3) * 220 },
        data: {
          ...node,
          status: buildNodeStatus(node, scenario, activeStepIndex),
          delta,
          direction,
          isRoot: node.id === scenario.rootNodeId,
          onActivate: activateFromNode,
        },
      }
    })
  }, [activateFromNode, activeEdges, activeStepIndex, scenario])

  const edges = useMemo<Edge<CausalEdgeData>[]>(() => {
    return scenario.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'causalEdge',
      animated: activeEdgeIds.has(edge.id),
      data: {
        ...edge,
        active: activeEdgeIds.has(edge.id),
      },
    }))
  }, [activeEdgeIds, scenario.edges])

  useEffect(() => {
    let mounted = true

    layoutGraph(nodes, edges).then((layouted) => {
      if (mounted) setLaidOutNodes(layouted)
    })

    return () => {
      mounted = false
    }
  }, [edges, nodes])

  return (
    <ReactFlowProvider>
      <div className="graph-shell">
        <ReactFlow
          nodes={laidOutNodes.length ? laidOutNodes : nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.35}
          maxZoom={1.35}
          nodesDraggable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#273244" gap={28} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}
