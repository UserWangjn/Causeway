import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, ShieldAlert, Sparkles } from 'lucide-react'
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
  const activeStepIndex = useScenarioStore((state) => state.activeStepIndex)
  const text = uiText[language]
  const currentStep = scenario.steps[activeStepIndex]
  const activeEdges = currentStep
    ? scenario.edges.filter((edge) => currentStep.edgeIds.includes(edge.id))
    : scenario.edges.filter((edge) => edge.source === scenario.rootNodeId)

  return (
    <aside className="side-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{text.scenarioRun}</p>
          <h1>{scenario.title}</h1>
        </div>
        <div className="agent-badge">
          <Sparkles size={16} />
          {text.agentChain}
        </div>
      </div>

      <p className="scenario-summary">{scenario.summary}</p>

      <div className="agent-stack" aria-label={text.agentPipeline}>
        {text.agents.map((agent, index) => (
          <span key={agent} className={index <= activeStepIndex + 2 ? 'agent-chip agent-chip--active' : 'agent-chip'}>
            {agent}
          </span>
        ))}
      </div>

      <section className="explanation-card">
        <div className="explanation-title">
          <ShieldAlert size={18} />
          <span>{currentStep ? currentStep.title : text.clickToStart}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep?.id ?? 'initial'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {currentStep?.narrative ?? text.initialNarrative}
          </motion.p>
        </AnimatePresence>
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
