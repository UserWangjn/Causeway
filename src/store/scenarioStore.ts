import { create } from 'zustand'
import { scenarios } from '../data/scenarios'
import type { Language } from '../types'

type ScenarioState = {
  scenarioId: string
  language: Language
  activeStepIndex: number
  isPlaying: boolean
  setScenario: (scenarioId: string) => void
  setLanguage: (language: Language) => void
  setStep: (stepIndex: number) => void
  nextStep: (maxIndex?: number) => void
  previousStep: () => void
  replay: () => void
  play: () => void
  pause: () => void
}

const getStepCount = (scenarioId: string) =>
  scenarios.find((scenario) => scenario.id === scenarioId)?.steps.length ?? 0

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarioId: scenarios[0].id,
  language: 'en',
  activeStepIndex: -1,
  isPlaying: false,
  setScenario: (scenarioId) =>
    set({
      scenarioId,
      activeStepIndex: -1,
      isPlaying: false,
    }),
  setLanguage: (language) => set({ language }),
  setStep: (stepIndex) => {
    const maxIndex = getStepCount(get().scenarioId) - 1
    set({ activeStepIndex: Math.max(-1, Math.min(stepIndex, maxIndex)) })
  },
  nextStep: (providedMaxIndex) => {
    const { activeStepIndex, scenarioId } = get()
    const maxIndex = providedMaxIndex ?? getStepCount(scenarioId) - 1
    set({
      activeStepIndex: Math.min(activeStepIndex + 1, maxIndex),
      isPlaying: activeStepIndex + 1 < maxIndex,
    })
  },
  previousStep: () => {
    const { activeStepIndex } = get()
    set({ activeStepIndex: Math.max(activeStepIndex - 1, -1), isPlaying: false })
  },
  replay: () => set({ activeStepIndex: -1, isPlaying: true }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
}))
