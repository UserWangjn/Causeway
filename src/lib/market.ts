import { copy } from './copy'
import { clamp } from './math'
import type { Market, MarketOutcome } from '../types/market'

export function marketIsSettled(market: Pick<Market, 'active' | 'closed'>) {
  return market.closed === true || market.active === false
}

export function marketIsTradable(market: Pick<Market, 'active' | 'closed' | 'archived' | 'staleDetectedAt' | 'acceptingOrders' | 'enableOrderBook'>) {
  return market.active !== false
    && market.closed !== true
    && market.archived !== true
    && !market.staleDetectedAt
    && market.acceptingOrders !== false
    && market.enableOrderBook !== false
}

export function marketTradingStatusLabel(market: Pick<Market, 'active' | 'closed' | 'archived' | 'staleDetectedAt' | 'acceptingOrders' | 'enableOrderBook'>) {
  if (market.closed) return copy('Settled')
  if (market.active === false) return copy('Inactive')
  if (market.archived) return copy('Archived')
  if (market.staleDetectedAt) return copy('Stale')
  if (market.acceptingOrders === false) return copy('Orders paused')
  if (market.enableOrderBook === false) return copy('Order book unavailable')
  return copy('Tradable')
}

export function formatMarketPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return copy('No price')
  if (value > 0 && value < 1) return '<1%'
  if (value % 1 === 0) return `${value}%`
  return `${value.toFixed(1)}%`
}

export function outcomePriceToPercent(price: number | null | undefined) {
  if (price == null || Number.isNaN(price)) return null
  return Math.round(price <= 1 ? clamp(price, 0, 1) * 100 : clamp(price, 0, 100))
}

export function unitPriceToPercent(price: number | null | undefined) {
  if (price == null || Number.isNaN(price)) return null
  return Math.round(clamp(price, 0, 1) * 100)
}

export function formatUnitPercent(price: number | null | undefined) {
  const percent = unitPriceToPercent(price)
  return percent == null ? copy('No price') : `${percent}%`
}

export function formatCents(price: number | null | undefined) {
  if (price == null || Number.isNaN(price)) return copy('No quote')
  const cents = clamp(price, 0, 1) * 100
  const precision = cents < 1 || cents > 99 || cents % 1 ? 1 : 0
  return `${cents.toFixed(precision)}¢`
}

export function getOutcomeRows(market: Market) {
  const sourceOutcomes =
    market.outcomes?.filter((outcome) => outcome.label) ||
    [
      { label: 'Yes', price: market.price / 100, tokenId: null },
      { label: 'No', price: 1 - market.price / 100, tokenId: null },
    ]
  return sourceOutcomes.map((outcome, index) => {
    const price = typeof outcome.price === 'number' ? clamp(outcome.price, 0, 1) : null
    return {
      ...outcome,
      index,
      price,
      yesPrice: price,
      noPrice: price == null ? null : 1 - price,
      percent: unitPriceToPercent(price),
    }
  })
}

export function formatToken(tokenId: string | null | undefined) {
  if (!tokenId) return copy('Not provided')
  return `${tokenId.slice(0, 6)}...${tokenId.slice(-6)}`
}

export function marketDisplayLabel(market: Market) {
  if (market.groupItemTitle) return market.groupItemTitle
  let label = market.title
  label = label.replace(/^Will\s+/i, '')
  label = label.replace(/\s+win\s+the\s+\d{4}\s+FIFA\s+World\s+Cup\??$/i, '')
  label = label.replace(/\s+be\s+the\s+top\s+grossing\s+movie\s+of\s+2026\??$/i, '')
  label = label.replace(/\s+win\s+on\s+\d{4}-\d{2}-\d{2}\??$/i, '')
  label = label.replace(/\?$/, '')
  return label || market.title
}

export function marketInferenceOutcome(market: Market): MarketOutcome | null {
  return market.outcomes?.find((outcome) => Boolean(outcome.outcomeId)) ?? null
}
