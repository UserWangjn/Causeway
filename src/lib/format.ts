import { copy } from './copy'

export function formatCompactMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return copy('No data')
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function formatCompactCount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.max(0, Math.round(value)))
}

export function formatProbability(value: number | null | undefined) {
  return value == null ? '' : `${Math.round(value * 100)}%`
}

export function formatConfidence(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return copy('N/A')
  return `${Math.round(value * 100)}%`
}
