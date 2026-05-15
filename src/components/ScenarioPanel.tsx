import { motion } from 'framer-motion'
import { ExternalLink, GitBranch } from 'lucide-react'
import { directionLabel, uiText } from '../i18n'
import { useScenarioStore } from '../store/scenarioStore'
import type { GraphEdge, ScenarioPreset } from '../types'

type ScenarioPanelProps = {
  scenario: ScenarioPreset
}

const deltaText = (edge: GraphEdge, text: { to: string; points: string }) => {
  const [low, high] = edge.deltaRange
  const sign = high >= 0 ? '+' : ''
  return `${sign}${Math.round(low * 100)} ${text.to} ${sign}${Math.round(high * 100)} ${text.points}`
}

export const ScenarioPanel = ({ scenario }: ScenarioPanelProps) => {
  const language = useScenarioStore((state) => state.language)
  const text = uiText[language]
  const activeEdges = scenario.edges
  const directEdges = scenario.edges.filter((edge) => edge.source === scenario.rootNodeId).length
  const secondOrderEdges = scenario.edges.length - directEdges

  return (
    <aside className="side-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{text.scenarioRun}</p>
          <h1>{scenario.title}</h1>
        </div>
        <div className="agent-badge agent-badge--static">
          <GitBranch size={16} />
          Flow
        </div>
      </div>

      <p className="scenario-summary">{scenario.summary}</p>

      <div className="flow-stats">
        <span>
          <strong>{scenario.nodes.length}</strong>
          PM nodes
        </span>
        <span>
          <strong>{scenario.edges.length}</strong>
          causal links
        </span>
        <span>
          <strong>{directEdges}/{secondOrderEdges}</strong>
          direct / indirect
        </span>
      </div>

      <section className="explanation-card explanation-card--compact">
        <div className="explanation-title">
          <GitBranch size={18} />
          <span>Final script flow</span>
        </div>
        <p>{scenario.steps.map((step) => step.narrative).join(' ')}</p>
      </section>

      <div className="edge-list">
        {activeEdges.map((edge) => {
          const target = scenario.nodes.find((node) => node.id === edge.target)
          return (
            <motion.article
              key={edge.id}
              className={`edge-card edge-card--${edge.direction}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="edge-card-header">
                <span>{directionLabel(edge.direction, language)}</span>
                <strong>{deltaText(edge, text)}</strong>
              </div>
              <h2>{target?.question}</h2>
              <p>{edge.explanation}</p>
              <div className="edge-meta">
                <span>
                  {Math.round(edge.confidence * 100)}% {text.confidence}
                </span>
                <span>
                  {text.strengthLabel[edge.strength]} {text.strength}
                </span>
              </div>
              <div className="evidence-row">
                {edge.evidenceUrls.slice(0, 2).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`${text.evidenceSource} ${url}`}>
                    <ExternalLink size={13} />
                    {text.source}
                  </a>
                ))}
              </div>
            </motion.article>
          )
        })}
      </div>
    </aside>
  )
}
