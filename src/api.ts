import type { GenerationEvent, ScenarioPreset, UniverseMarket } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export const fetchScenarioPresets = async (): Promise<ScenarioPreset[]> => {
  const response = await fetch(`${API_BASE_URL}/api/graph/scenario-presets?use_ai=true`)
  if (!response.ok) {
    throw new Error(`Scenario API failed: ${response.status}`)
  }
  return response.json()
}

export const fetchMarketUniverse = async (): Promise<UniverseMarket[]> => {
  const response = await fetch(`${API_BASE_URL}/api/markets/universe?limit=32`)
  if (!response.ok) {
    throw new Error(`Market universe API failed: ${response.status}`)
  }
  return response.json()
}

export const generateScenario = async (rootMarketId: string): Promise<ScenarioPreset> => {
  const response = await fetch(`${API_BASE_URL}/api/scenario/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root_market_id: rootMarketId, use_ai: true }),
  })
  if (!response.ok) {
    throw new Error(`Scenario generation failed: ${response.status}`)
  }
  return response.json()
}

export const generateScenarioStream = async (
  rootMarketId: string,
  onEvent: (event: GenerationEvent) => void,
): Promise<ScenarioPreset> => {
  const response = await fetch(`${API_BASE_URL}/api/scenario/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root_market_id: rootMarketId, use_ai: true }),
  })
  if (!response.ok || !response.body) {
    throw new Error(`Scenario generation stream failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalScenario: ScenarioPreset | undefined

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const dataLine = chunk
        .split('\n')
        .find((line) => line.startsWith('data:'))
        ?.replace(/^data:\s*/, '')
      if (!dataLine) continue

      const event = JSON.parse(dataLine) as GenerationEvent
      onEvent(event)
      if (event.type === 'error') {
        throw new Error(event.message)
      }
      if (event.type === 'done' && event.scenario) {
        finalScenario = event.scenario
      }
    }
  }

  if (!finalScenario) {
    throw new Error('Scenario generation stream ended without a final scenario')
  }
  return finalScenario
}
