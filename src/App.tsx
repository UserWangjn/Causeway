import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Search, Share2 } from 'lucide-react'
import { fetchMarketUniverse, generateScenarioStream } from './api'
import { GenerationFlow } from './components/GenerationFlow'
import { LanguageToggle } from './components/LanguageToggle'
import { MarketUniverse } from './components/MarketUniverse'
import { ScenarioGraph } from './components/ScenarioGraph'
import { ScenarioPanel } from './components/ScenarioPanel'
import { ScenarioTabs } from './components/ScenarioTabs'
import { scenarios as mockScenarios } from './data/scenarios'
import { translateScenario, uiText } from './i18n'
import { useScenarioStore } from './store/scenarioStore'
import type { GenerationEvent, ScenarioPreset, UniverseMarket } from './types'

const GENERATION_STEP_MS = 980

type AppMode = 'universe' | 'generating' | 'scenario'

function App() {
  const scenarioId = useScenarioStore((state) => state.scenarioId)
  const language = useScenarioStore((state) => state.language)
  const pause = useScenarioStore((state) => state.pause)
  const setScenario = useScenarioStore((state) => state.setScenario)
  const setStep = useScenarioStore((state) => state.setStep)

  const [mode, setMode] = useState<AppMode>('universe')
  const [markets, setMarkets] = useState<UniverseMarket[]>([])
  const [selectedMarket, setSelectedMarket] = useState<UniverseMarket | undefined>()
  const [generatedScenarios, setGeneratedScenarios] = useState<ScenarioPreset[]>([])
  const [loadingUniverse, setLoadingUniverse] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generationStep, setGenerationStep] = useState(0)
  const [generationEvents, setGenerationEvents] = useState<GenerationEvent[]>([])

  const scenarioCatalog = generatedScenarios.length ? generatedScenarios : mockScenarios
  const baseScenario = scenarioCatalog.find((candidate) => candidate.id === scenarioId) ?? scenarioCatalog[0]
  const scenario = useMemo(
    () => (baseScenario?.source ? baseScenario : translateScenario(baseScenario, language)),
    [baseScenario, language],
  )
  const text = uiText[language]
  const sourceLabel =
    mode === 'universe'
      ? loadingUniverse
        ? 'Loading PM'
        : 'Live PM Universe'
      : scenario?.aiStatus === 'refined'
        ? 'Live PM + AI'
        : 'Live PM'

  useEffect(() => {
    let cancelled = false

    fetchMarketUniverse()
      .then((items) => {
        if (cancelled) return
        setMarkets(items)
        setSelectedMarket(items[0])
        setLoadError(null)
      })
      .catch((error: Error) => {
        if (cancelled) return
        setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingUniverse(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mode !== 'generating') return
    const timer = window.setInterval(() => {
      setGenerationStep((step) => Math.min(step + 1, 5))
    }, GENERATION_STEP_MS)
    return () => window.clearInterval(timer)
  }, [mode])

  const startGeneration = async () => {
    if (!selectedMarket) return
    setMode('generating')
    setGenerationStep(0)
    setGenerationEvents([
      {
        type: 'root',
        step: 0,
        message: `Preparing live PM root: ${selectedMarket.question}`,
        data: { root: selectedMarket },
      },
    ])
    try {
      const generated = await generateScenarioStream(selectedMarket.id, (event) => {
        setGenerationStep(event.step)
        setGenerationEvents((current) => [...current, event].slice(-16))
      })
      if (generated.aiStatus !== 'refined') {
        throw new Error(generated.aiError ?? 'AI refinement did not complete')
      }
      setGeneratedScenarios((current) => [generated, ...current.filter((item) => item.id !== generated.id)].slice(0, 5))
      setScenario(generated.id)
      setStep(generated.steps.length - 1)
      setMode('scenario')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Scenario generation failed')
      setMode('universe')
    }
  }

  const returnToUniverse = () => {
    pause()
    setStep(-1)
    setMode('universe')
  }

  return (
    <main className="app">
      <div className="app-topbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <div>
            <strong>{text.brandTitle}</strong>
            <span
              className={
                sourceLabel.includes('AI')
                  ? 'source-pill source-pill--live'
                  : loadingUniverse
                    ? 'source-pill source-pill--loading'
                    : 'source-pill source-pill--live'
              }
              title={loadError ?? scenario?.aiError}
            >
              {sourceLabel}
            </span>
          </div>
        </div>

        <div className="market-search" aria-label="Market search">
          <Search size={15} />
          <span>Search markets</span>
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </div>

        <div className="topbar-actions">
          {mode === 'scenario' && (
            <button className="toolbar-button" type="button" onClick={returnToUniverse}>
              <ArrowLeft size={15} />
              Market universe
            </button>
          )}
          {mode === 'scenario' && <ScenarioTabs scenarios={scenarioCatalog} />}
          <button className="toolbar-button" type="button" aria-label="Export graph">
            <Download size={15} />
            Export
          </button>
          <button className="toolbar-button toolbar-button--primary" type="button" aria-label="Share graph">
            <Share2 size={15} />
            Share
          </button>
          <LanguageToggle />
        </div>
      </div>

      {mode === 'universe' && (
        <MarketUniverse
          markets={markets}
          selectedMarket={selectedMarket}
          loading={loadingUniverse}
          error={loadError}
          onSelect={setSelectedMarket}
          onGenerate={startGeneration}
        />
      )}

      {mode === 'generating' && selectedMarket && (
        <GenerationFlow market={selectedMarket} activeStep={generationStep} events={generationEvents} />
      )}

      {mode === 'scenario' && scenario && (
        <section className="workspace">
          <div className="canvas-area">
            <div className="canvas-header">
              <div>
                <p className="eyebrow">{text.graphEyebrow}</p>
                <h2>{scenario.subtitle}</h2>
              </div>
              <div className="legend">
                <span className="legend-up">{text.up}</span>
                <span className="legend-down">{text.down}</span>
                <span className="legend-uncertain">{text.uncertain}</span>
              </div>
            </div>
            <ScenarioGraph scenario={scenario} />
          </div>
          <ScenarioPanel scenario={scenario} />
        </section>
      )}
    </main>
  )
}

export default App
