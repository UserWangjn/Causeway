import { Languages } from 'lucide-react'
import { useScenarioStore } from '../store/scenarioStore'
import type { Language } from '../types'

const options: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'zh', label: '中文' },
]

export const LanguageToggle = () => {
  const language = useScenarioStore((state) => state.language)
  const setLanguage = useScenarioStore((state) => state.setLanguage)

  return (
    <div className="language-toggle" aria-label="Language switcher">
      <Languages size={16} />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === language ? 'language-option language-option--active' : 'language-option'}
          onClick={() => setLanguage(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
