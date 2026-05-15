import ELK from 'elkjs/lib/elk.bundled.js'
import type { Edge, Node } from '@xyflow/react'

const elk = new ELK()

export const layoutGraph = async <
  NodeData extends Record<string, unknown>,
  EdgeData extends Record<string, unknown>,
>(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
) => {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '52',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.edgeRouting': 'SPLINES',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: 280,
      height: 140,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  }

  const layout = await elk.layout(graph)
  const positioned = nodes.map((node) => {
    const layoutNode = layout.children?.find((child) => child.id === node.id)

    return {
      ...node,
      position: {
        x: layoutNode?.x ?? node.position.x,
        y: layoutNode?.y ?? node.position.y,
      },
    }
  })

  return positioned
}
