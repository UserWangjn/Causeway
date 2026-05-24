import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { copy } from '../../lib/copy'
import { formatRelativeTime } from '../../lib/datetime'
import { formatCompactCount } from '../../lib/format'
import { clamp } from '../../lib/math'
import {
  formatCents,
  formatMarketPercent,
  formatToken,
  getOutcomeRows,
  marketDisplayLabel,
  marketIsSettled,
  marketIsTradable,
  marketTradingStatusLabel,
  unitPriceToPercent,
} from '../../lib/market'
import type { Market } from '../../types/market'
import './market-components.css'

export type OrderbookOutcomeAction = {
  label: string
  outcomeId: string | null
  price: number | null
  tone: 'yes' | 'no'
}

type MarketOrderBookProps = {
  eventMarkets: Market[]
  hasMoreMarkets?: boolean
  loading: boolean
  market: Market
  onSelectOutcome: (market: Market, action: OrderbookOutcomeAction) => void
  selectedOutcomeId: string | null
  totalMarkets?: number | null
}

export function MarketOrderBook({
  eventMarkets,
  hasMoreMarkets = false,
  loading,
  market,
  onSelectOutcome,
  selectedOutcomeId,
  totalMarkets,
}: MarketOrderBookProps) {
  const [orderError, setOrderError] = useState<string | null>(null)
  const [marketQuery, setMarketQuery] = useState('')
  const [settledExpanded, setSettledExpanded] = useState(false)
  const normalizedMarketQuery = marketQuery.trim().toLowerCase()
  const sortedEventMarkets = eventMarkets.length > 1
    ? [...eventMarkets].sort((a, b) => b.price - a.price || (b.volumeValue || 0) - (a.volumeValue || 0))
    : eventMarkets
  const visibleEventMarkets = normalizedMarketQuery
    ? sortedEventMarkets.filter((item) => {
        const haystack = [
          marketDisplayLabel(item),
          item.title,
          item.eventTitle,
          item.slug,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(normalizedMarketQuery)
      })
    : sortedEventMarkets
  const outcomeRows =
    eventMarkets.length > 1
      ? visibleEventMarkets
          .map((item, index) => ({
            id: item.id,
            market: item,
            label: marketDisplayLabel(item),
            subtitle: copy(`Token ${formatToken(item.outcomes?.[0]?.tokenId)} · Market volume ${item.volume}`),
            index,
            percent: item.price,
            bid: item.bestBid ?? item.price / 100,
            ask: item.bestAsk ?? item.price / 100,
            actions: marketOutcomeActions(item),
          }))
      : marketOutcomeRows(market)
  const settledOutcomeRows = outcomeRows.filter((outcome) => marketIsSettled(outcome.market))
  const activeOutcomeRows = outcomeRows.filter((outcome) => !marketIsSettled(outcome.market))
  const showSettledRows = settledExpanded || Boolean(normalizedMarketQuery)
  const renderedOutcomeRows = showSettledRows ? [...activeOutcomeRows, ...settledOutcomeRows] : activeOutcomeRows
  const loadedMarketCount = eventMarkets.length > 1 ? eventMarkets.length : outcomeRows.length
  const visibleMarketCountLabel = `${outcomeRows.length}${normalizedMarketQuery ? ` / ${loadedMarketCount}` : ''}`
  const orderbookCountText = eventMarkets.length > 1
    ? copy(
      `${visibleMarketCountLabel} market${outcomeRows.length === 1 ? '' : 's'}${hasMoreMarkets && totalMarkets ? ` (loaded ${loadedMarketCount} / ${formatCompactCount(totalMarkets)})` : ''}`,
    )
    : copy(`${outcomeRows.length} market${outcomeRows.length === 1 ? '' : 's'}`)
  const orderbookStatusText = marketIsTradable(market) ? copy('Tradable') : marketTradingStatusLabel(market)
  const handleOutcomeSelect = useCallback((row: typeof outcomeRows[number], action: OrderbookOutcomeAction) => {
    if (!action.outcomeId) {
      setOrderError('Selected outcome is missing an outcomeId.')
      return
    }
    if (!marketIsTradable(row.market)) {
      setOrderError('This market is settled or not accepting orders, so it cannot be traded.')
      return
    }
    setOrderError(null)
    onSelectOutcome(row.market, action)
  }, [onSelectOutcome])
  return (
    <div className="market-orderbook">
      <div className="orderbook-head">
        <div>
          <b>{copy('Markets')}</b>
          <span>{loading ? copy('Syncing event markets...') : `${orderbookCountText} · ${orderbookStatusText}`}</span>
        </div>
        <div className="orderbook-meta">
          <span>Vol. {market.volume}</span>
          {market.lastTradePrice != null ? <span>Last {formatCents(market.lastTradePrice)}</span> : null}
        </div>
      </div>
      {eventMarkets.length > 8 ? (
        <label className="orderbook-search">
          <Search size={16} />
          <input
            aria-label="Search event markets"
            onChange={(event) => setMarketQuery(event.target.value)}
            placeholder="Search markets in this event"
            type="search"
            value={marketQuery}
          />
        </label>
      ) : null}
      {settledOutcomeRows.length && !normalizedMarketQuery ? (
        <button
          className="orderbook-settled-toggle"
          type="button"
          aria-expanded={settledExpanded}
          onClick={() => setSettledExpanded((expanded) => !expanded)}
        >
          {settledExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>{copy(`${settledOutcomeRows.length} settled market${settledOutcomeRows.length === 1 ? '' : 's'}`)}</span>
          <b>{settledExpanded ? copy('Hide') : copy('Show')}</b>
        </button>
      ) : null}
      <div className="orderbook-list">
        {outcomeRows.length && renderedOutcomeRows.length ? renderedOutcomeRows.map((outcome) => {
          const tradable = marketIsTradable(outcome.market)
          const statusLabel = marketTradingStatusLabel(outcome.market)
          return (
            <div className={marketIsSettled(outcome.market) ? 'orderbook-row settled' : 'orderbook-row'} key={outcome.id}>
              <div className="orderbook-title">
                <b>{outcome.label}</b>
                <span>{outcome.subtitle} / {statusLabel}</span>
              </div>
              <div className="orderbook-price">
                <strong>{formatMarketPercent(outcome.percent)}</strong>
                <span>{marketQuoteMeta(outcome.market)}</span>
              </div>
              <div className="orderbook-quotes">
                <span>Bid {formatCents(outcome.bid)}</span>
                <span>Ask {formatCents(outcome.ask)}</span>
              </div>
              <div className="orderbook-actions">
                {outcome.actions.map((action) => (
                  <button
                    className={[
                      action.tone === 'no' ? 'buy-no' : 'buy-yes',
                      'orderbook-order-button',
                      selectedOutcomeId === action.outcomeId ? 'selected' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={loading || !tradable || !action.outcomeId}
                    key={action.label}
                    type="button"
                    aria-label={copy(`Analyze ${outcome.label} ${action.label} ${formatCents(action.price)}`)}
                    aria-pressed={selectedOutcomeId === action.outcomeId}
                    title={tradable ? undefined : statusLabel}
                    onClick={() => handleOutcomeSelect(outcome, action)}
                  >
                    <span className="orderbook-button-action">{tradable ? copy('Analyze') : statusLabel}</span>
                    <span className="orderbook-button-outcome">{action.label}</span>
                    <span className="orderbook-button-price">{formatCents(action.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        }) : outcomeRows.length ? (
          <div className="orderbook-empty">{copy('Settled markets are collapsed. Use Show to view them; they cannot be traded.')}</div>
        ) : (
          <div className="orderbook-empty">{hasMoreMarkets ? copy('No matches in the loaded markets. Try another keyword or open the original Polymarket event to confirm.') : copy('No markets match this search.')}</div>
        )}
      </div>
      {orderError ? <div className="status-note error">{orderError}</div> : null}
    </div>
  )
}

function marketOutcomeActions(market: Market): OrderbookOutcomeAction[] {
  const outcomes = market.outcomes ?? []
  const yesOutcome = findOutcomeByLabel(outcomes, 'yes') ?? outcomes[0]
  const noOutcome = findOutcomeByLabel(outcomes, 'no') ?? outcomes[1]
  const yesPrice = firstValidUnitPrice(market.bestAsk, yesOutcome?.price, market.lastTradePrice, market.price / 100)
  const noPrice = firstValidUnitPrice(noOutcome?.price, market.bestBid == null ? null : 1 - market.bestBid, yesPrice == null ? null : 1 - yesPrice)
  const actions: OrderbookOutcomeAction[] = []
  if (yesOutcome?.outcomeId) {
    actions.push({ label: yesOutcome.label || 'Yes', outcomeId: yesOutcome.outcomeId, price: yesPrice, tone: 'yes' })
  }
  if (noOutcome?.outcomeId) {
    actions.push({ label: noOutcome.label || 'No', outcomeId: noOutcome.outcomeId, price: noPrice, tone: 'no' })
  }
  return actions.length ? actions : [{ label: 'Yes', outcomeId: null, price: yesPrice, tone: 'yes' }]
}

function marketOutcomeRows(market: Market) {
  const actions = marketOutcomeActions(market)
  const isBinary = actions.length >= 2 && actions.some((action) => action.tone === 'yes') && actions.some((action) => action.tone === 'no')
  if (isBinary) {
    const yesPrice = actions.find((action) => action.tone === 'yes')?.price ?? market.bestAsk ?? market.price / 100
    return [{
      id: market.id,
      market,
      label: marketDisplayLabel(market),
      subtitle: copy(`Token ${formatToken(market.outcomes?.[0]?.tokenId)} · Market volume ${market.volume}`),
      index: 0,
      percent: unitPriceToPercent(yesPrice),
      bid: market.bestBid ?? yesPrice,
      ask: market.bestAsk ?? yesPrice,
      actions,
    }]
  }

  return getOutcomeRows(market).map((outcome) => ({
    id: `${outcome.label}-${outcome.index}`,
    market,
    label: outcome.label,
    subtitle: copy(`Token ${formatToken(outcome.tokenId)} · Market volume ${market.volume}`),
    index: outcome.index,
    percent: outcome.percent,
    bid: outcome.index === 0 ? market.bestBid ?? outcome.yesPrice : outcome.yesPrice,
    ask: outcome.index === 0 ? market.bestAsk ?? outcome.yesPrice : outcome.yesPrice,
    actions: [{
      label: outcome.label,
      outcomeId: outcome.outcomeId ?? null,
      price: outcome.yesPrice,
      tone: outcome.label.toLowerCase() === 'no' ? 'no' as const : 'yes' as const,
    }],
  }))
}

function findOutcomeByLabel(outcomes: NonNullable<Market['outcomes']>, label: string) {
  return outcomes.find((outcome) => outcome.label.trim().toLowerCase() === label)
}

function firstValidUnitPrice(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return clamp(value, 0, 1)
  }
  return null
}

function marketQuoteMeta(market: Market) {
  if (market.lastTradePrice != null) return `Last ${formatCents(market.lastTradePrice)}`
  if (market.syncedAt) return `Synced ${formatRelativeTime(market.syncedAt)}`
  return copy('Current quote')
}
