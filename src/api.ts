import type { ScenarioPreset, UniverseMarket } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export const fetchScenarioPresets = async (): Promise<ScenarioPreset[]> => {
  const response = await fetch(`${API_BASE_URL}/api/graph/scenario-presets?use_ai=true`)
  if (!response.ok) {
    throw new Error(`Scenario API failed: ${response.status}`)
  }
  return response.json()
}

export const fetchMarketUniverse = async (): Promise<UniverseMarket[]> => {
  const response = await fetch(`${API_BASE_URL}/api/markets/universe?limit=48`)
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
