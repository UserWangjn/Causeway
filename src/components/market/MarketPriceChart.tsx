import { useEffect, useMemo, useState } from 'react'
import { copy } from '../../lib/copy'
import { formatDate } from '../../lib/datetime'
import { clamp } from '../../lib/math'
import { formatUnitPercent, getOutcomeRows, marketDisplayLabel, marketIsSettled } from '../../lib/market'
import type { ChartRow, Market, PricePoint } from '../../types/market'
import './market-components.css'

type MarketPriceChartProps = {
  eventMarkets: Market[]
  focusMarket?: Market
  loadPriceHistory: (tokenIds: string[], signal: AbortSignal) => Promise<Record<string, PricePoint[]>>
  market: Market
}

const HISTORY_CHART_LEFT = 36
const HISTORY_CHART_RIGHT = 724
const HISTORY_CHART_TOP = 38
const HISTORY_CHART_BOTTOM = 272
const HISTORY_CHART_MAX_PRICE = 1
const HISTORY_CHART_MAX_ROWS = 8

export function MarketPriceChart({ eventMarkets, focusMarket, loadPriceHistory, market }: MarketPriceChartProps) {
  return <HistoricalMarketPriceChart eventMarkets={eventMarkets} focusMarket={focusMarket} loadPriceHistory={loadPriceHistory} market={market} />
}

function HistoricalMarketPriceChart({ eventMarkets, focusMarket, loadPriceHistory, market }: MarketPriceChartProps) {
  const [historyByToken, setHistoryByToken] = useState<Record<string, PricePoint[]>>({})
  const chartRows = useMemo(
    () => buildHistoryChartCandidates(eventMarkets, market, focusMarket),
    [eventMarkets, focusMarket, market],
  )
  const tokenIds = useMemo(() => Array.from(new Set(chartRows.map((row) => row.tokenId).filter(Boolean))), [chartRows])
  const historyKey = [...tokenIds].sort().join(',')

  useEffect(() => {
    if (!historyKey) return
    const controller = new AbortController()
    loadPriceHistory(tokenIds, controller.signal)
      .then((history) => {
        const normalizedHistory = Object.fromEntries(
          Object.entries(history || {}).map(([tokenId, points]) => [
            tokenId,
            compactHistory(normalizeHistoryPoints(points)),
          ]),
        )
        setHistoryByToken((current) => ({ ...current, ...normalizedHistory }))
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setHistoryByToken((current) => current)
      })
    return () => controller.abort()
  }, [historyKey, loadPriceHistory, tokenIds])

  const currentHistory = historyByToken
  const allPoints = tokenIds.flatMap((tokenId) => currentHistory[tokenId] || [])
  const minT = allPoints.length ? Math.min(...allPoints.map((point) => point.t)) : 0
  const maxT = allPoints.length ? Math.max(...allPoints.map((point) => point.t)) : 1
  const hasHistory = allPoints.length > 1
  const maxPrice = HISTORY_CHART_MAX_PRICE
  const ticks = chartTicks(maxPrice)

  return (
    <div className="market-price-chart">
      <div className="market-chart-toolbar">
        <div className="market-chart-legend">
          {chartRows.slice(0, 4).map((outcome) => (
            <span className={`chart-key ${outcomeTone(outcome.index)}`} key={outcome.id}>
              <i />
              {outcome.label} <b>{formatUnitPercent(outcome.price)}</b>
            </span>
          ))}
        </div>
        <div className="chart-range-tabs">
          {['1H', '6H', '1D', '1W', '1M', 'ALL'].map((range) => (
            <button className={range === 'ALL' ? 'active' : ''} key={range} type="button">
              {range}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 760 336" aria-label={copy('Market price chart')}>
        <g className="grid-lines">
          {ticks.map((tick) => {
            const y = chartY(tick, maxPrice)
            return <path d={`M${HISTORY_CHART_LEFT} ${y.toFixed(1)}H${HISTORY_CHART_RIGHT}`} key={tick} />
          })}
        </g>
        <text className="chart-watermark" x="560" y="62">Polymarket</text>
        <g className="chart-axis">
          {ticks.map((tick) => {
            const y = chartY(tick, maxPrice)
            return (
              <text x="725" y={y + 4} key={`label:${tick}`}>
                {Math.round(tick * 100)}%
              </text>
            )
          })}
          <text x="36" y="314">{copy('Market start')}</text>
          <text x="648" y="314">{formatDate(market.endDate)}</text>
        </g>
        {chartRows.map((outcome) => (
          <path
            className={`market-chart-line ${outcomeTone(outcome.index)}`}
            d={
              outcome.tokenId && currentHistory[outcome.tokenId]?.length > 1
                ? historyPath(currentHistory[outcome.tokenId], minT, maxT, maxPrice)
                : chartPlaceholderPath(outcome.price, maxPrice)
            }
            key={outcome.id}
          />
        ))}
        {hasHistory
          ? chartRows.map((outcome) => {
              const points = outcome.tokenId ? currentHistory[outcome.tokenId] : undefined
              const lastPoint = points?.[points.length - 1]
              if (!lastPoint) return null
              const x =
                HISTORY_CHART_LEFT +
                ((lastPoint.t - minT) / Math.max(1, maxT - minT)) * (HISTORY_CHART_RIGHT - HISTORY_CHART_LEFT)
              const y = chartY(lastPoint.p, maxPrice)
              return <circle className={`chart-last-point ${outcomeTone(outcome.index)}`} cx={x} cy={y} key={`${outcome.id}:last`} r="5" />
            })
          : null}
      </svg>
    </div>
  )
}

function outcomeTone(index: number) {
  return ['blue', 'indigo', 'amber', 'orange', 'green', 'purple'][index % 6]
}

function chartY(price: number, maxPrice: number) {
  const scale = Math.max(0.01, maxPrice)
  return HISTORY_CHART_BOTTOM - (clamp(price, 0, scale) / scale) * (HISTORY_CHART_BOTTOM - HISTORY_CHART_TOP)
}

function chartTicks(maxPrice: number) {
  return [maxPrice, maxPrice * 0.75, maxPrice * 0.5, maxPrice * 0.25, 0]
}

function historyPath(points: PricePoint[], minT: number, maxT: number, maxPrice: number) {
  if (points.length < 2) return ''
  const span = Math.max(1, maxT - minT)
  return points
    .map((point, index) => {
      const x = HISTORY_CHART_LEFT + ((point.t - minT) / span) * (HISTORY_CHART_RIGHT - HISTORY_CHART_LEFT)
      const y = chartY(point.p, maxPrice)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function chartPlaceholderPath(price: number | null, maxPrice: number) {
  const y = chartY(price ?? 0.5, maxPrice)
  return `M${HISTORY_CHART_LEFT} ${y.toFixed(1)}H${HISTORY_CHART_RIGHT}`
}

function compactHistory(points: PricePoint[]) {
  if (points.length <= 240) return points
  const step = Math.ceil(points.length / 240)
  return points.filter((_, index) => index % step === 0 || index === points.length - 1)
}

function normalizeHistoryPoints(points: PricePoint[]) {
  const pointByTimestamp = new Map<number, PricePoint>()
  points.forEach((point) => {
    if (typeof point.t !== 'number' || typeof point.p !== 'number') return
    if (!Number.isFinite(point.t) || !Number.isFinite(point.p)) return
    pointByTimestamp.set(point.t, { t: point.t, p: clamp(point.p, 0, 1) })
  })
  return Array.from(pointByTimestamp.values()).sort((a, b) => a.t - b.t)
}

function compareHistoryChartMarkets(left: Market, right: Market, focusMarketId?: string | null) {
  if (focusMarketId) {
    if (left.id === focusMarketId && right.id !== focusMarketId) return -1
    if (right.id === focusMarketId && left.id !== focusMarketId) return 1
  }
  const leftSettled = marketIsSettled(left) ? 1 : 0
  const rightSettled = marketIsSettled(right) ? 1 : 0
  if (leftSettled !== rightSettled) return leftSettled - rightSettled
  const leftLabel = marketDisplayLabel(left).toLowerCase()
  const rightLabel = marketDisplayLabel(right).toLowerCase()
  return leftLabel.localeCompare(rightLabel) || left.id.localeCompare(right.id)
}

function buildHistoryChartCandidates(eventMarkets: Market[], market: Market, focusMarket?: Market): ChartRow[] {
  if (eventMarkets.length > 1) {
    const focusMarketId = focusMarket?.id ?? null
    const selectedMarkets = [
      ...eventMarkets.filter((item) => item.id === focusMarketId),
      ...eventMarkets.filter((item) => item.id !== focusMarketId),
    ].slice(0, HISTORY_CHART_MAX_ROWS)
    return selectedMarkets
      .sort((left, right) => compareHistoryChartMarkets(left, right, focusMarketId))
      .slice(0, HISTORY_CHART_MAX_ROWS)
      .map((item, index) => ({
        id: item.id,
        index,
        label: marketDisplayLabel(item),
        price: item.price / 100,
        tokenId: item.outcomes?.[0]?.tokenId || '',
      }))
  }

  return getOutcomeRows(market).slice(0, 5).map((outcome) => ({
    id: `${outcome.outcomeId ?? outcome.label}-${outcome.index}`,
    index: outcome.index,
    label: outcome.label,
    price: outcome.price,
    tokenId: outcome.tokenId || '',
  }))
}
