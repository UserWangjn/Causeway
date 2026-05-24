import { copy } from './copy'

export function formatDate(value: string | null | undefined) {
  if (!value) return copy('Not provided')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return copy('Not provided')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return copy('Not updated')
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return formatDateTime(value)
  const diffMs = Date.now() - timestamp
  const absMs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (absMs < minute) return copy('Just now')
  if (absMs < hour) return `${Math.max(1, Math.round(absMs / minute))}m ago`
  if (absMs < day) return `${Math.max(1, Math.round(absMs / hour))}h ago`
  return `${Math.max(1, Math.round(absMs / day))}d ago`
}
