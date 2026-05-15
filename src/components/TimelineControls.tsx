import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { uiText } from '../i18n'
import { useScenarioStore } from '../store/scenarioStore'
import type { ScenarioPreset } from '../types'

type TimelineControlsProps = {
  scenario: ScenarioPreset
}

export const TimelineControls = ({ scenario }: TimelineControlsProps) => {
  const language = useScenarioStore((state) => state.language)
  const activeStepIndex = useScenarioStore((state) => state.activeStepIndex)
  const isPlaying = useScenarioStore((state) => state.isPlaying)
  const play = useScenarioStore((state) => state.play)
  const pause = useScenarioStore((state) => state.pause)
  const previousStep = useScenarioStore((state) => state.previousStep)
  const nextStep = useScenarioStore((state) => state.nextStep)
  const replay = useScenarioStore((state) => state.replay)
  const text = uiText[language]

  const progress = ((activeStepIndex + 1) / scenario.steps.length) * 100

  return (
    <div className="timeline">
      <div className="timeline-buttons" aria-label={text.controls}>
        <button type="button" onClick={replay} aria-label={text.replay}>
          <RotateCcw size={18} />
        </button>
        <button type="button" onClick={previousStep} aria-label={text.previous}>
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={isPlaying ? pause : play}
          aria-label={isPlaying ? text.pause : text.play}
        >
          {isPlaying ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <button type="button" onClick={() => nextStep(scenario.steps.length - 1)} aria-label={text.next}>
          <SkipForward size={18} />
        </button>
      </div>

      <div className="timeline-track" aria-hidden="true">
        <div className="timeline-fill" style={{ width: `${Math.max(0, progress)}%` }} />
        {scenario.steps.map((step, index) => (
          <span
            key={step.id}
            className={index <= activeStepIndex ? 'timeline-dot timeline-dot--active' : 'timeline-dot'}
            style={{ left: `${((index + 1) / scenario.steps.length) * 100}%` }}
          />
        ))}
      </div>

      <div className="timeline-label">
        <span>{activeStepIndex < 0 ? text.ready : `${text.step} ${activeStepIndex + 1}`}</span>
        <strong>{scenario.steps[activeStepIndex]?.title ?? text.awaitingTrigger}</strong>
      </div>
    </div>
  )
}
