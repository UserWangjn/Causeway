import { Landmark, Scale, TrendingUp } from 'lucide-react'
import { translateScenario, uiText } from '../i18n'
import { useScenarioStore } from '../store/scenarioStore'
import type { ScenarioPreset } from '../types'

const icons = [Landmark, TrendingUp, Scale]

type ScenarioTabsProps = {
  scenarios: ScenarioPreset[]
}

export const ScenarioTabs = ({ scenarios }: ScenarioTabsProps) => {
  const scenarioId = useScenarioStore((state) => state.scenarioId)
  const language = useScenarioStore((state) => state.language)
  const setScenario = useScenarioStore((state) => state.setScenario)
  const text = uiText[language]

  return (
    <div className="scenario-tabs" role="tablist" aria-label={text.demoScenarios}>
      {scenarios.map((scenario, index) => {
        const Icon = icons[index] ?? Landmark
        const translated = scenario.source ? scenario : translateScenario(scenario, language)
        return (
          <button
            key={scenario.id}
            type="button"
            role="tab"
            aria-selected={scenario.id === scenarioId}
            className={scenario.id === scenarioId ? 'scenario-tab scenario-tab--active' : 'scenario-tab'}
            onClick={() => setScenario(scenario.id)}
          >
            <Icon size={16} />
            <span>{translated.title}</span>
          </button>
        )
      })}
    </div>
  )
}
