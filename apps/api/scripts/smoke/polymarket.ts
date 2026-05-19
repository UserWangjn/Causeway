import {
  fetchJson,
  fetchText,
  formatUnknownError,
  isEnabled,
  isRecord,
  printSummary,
  readEnv,
  readOptionalEnv,
  readPositiveInteger,
  stringArrayFromUnknown,
} from './shared';

const SMOKE_NAME = 'polymarket-readonly';
const ENABLED_ENV = 'SMOKE_POLYMARKET_ENABLED';

async function main(): Promise<void> {
  if (!isEnabled(ENABLED_ENV)) {
    printSummary({
      name: SMOKE_NAME,
      status: 'skipped',
      details: {
        reason: `Set ${ENABLED_ENV}=true to run real Polymarket read-only smoke checks`,
      },
    });
    return;
  }

  const timeoutMs = readPositiveInteger('SMOKE_HTTP_TIMEOUT_MS', readPositiveInteger('POLYMARKET_HTTP_TIMEOUT_MS', 10_000));
  const gammaBaseUrl = readEnv('POLYMARKET_GAMMA_BASE_URL', 'https://gamma-api.polymarket.com');
  const clobBaseUrl = readEnv('POLYMARKET_CLOB_BASE_URL', 'https://clob.polymarket.com');
  const dataBaseUrl = readEnv('POLYMARKET_DATA_BASE_URL', 'https://data-api.polymarket.com');
  const gammaLimit = readPositiveInteger('SMOKE_POLYMARKET_MARKET_LIMIT', 5);

  const marketsUrl = new URL('/markets', gammaBaseUrl);
  marketsUrl.searchParams.set('limit', String(gammaLimit));
  marketsUrl.searchParams.set('active', 'true');
  marketsUrl.searchParams.set('closed', 'false');
  const marketsPayload = await fetchJson(marketsUrl, timeoutMs, jsonHeaders());
  if (!Array.isArray(marketsPayload) || marketsPayload.length === 0) {
    throw new Error('Gamma smoke returned no active markets');
  }

  const tokenId = readOptionalEnv('SMOKE_CLOB_TOKEN_ID') ?? findFirstClobTokenId(marketsPayload);
  if (!tokenId) {
    throw new Error('Gamma smoke did not return a market with a CLOB token id; set SMOKE_CLOB_TOKEN_ID to override');
  }

  const healthPath = readEnv('SMOKE_CLOB_HEALTH_PATH', '/ok');
  const clobHealthText = healthPath ? await fetchText(new URL(healthPath, clobBaseUrl), timeoutMs, jsonHeaders()) : null;

  const bookUrl = new URL('/book', clobBaseUrl);
  bookUrl.searchParams.set('token_id', tokenId);
  const bookPayload = await fetchJson(bookUrl, timeoutMs, jsonHeaders());
  if (!isOrderBookPayload(bookPayload)) {
    throw new Error('CLOB smoke returned an invalid order book body');
  }

  const walletAddress = readOptionalEnv('SMOKE_POLYMARKET_WALLET_ADDRESS');
  const dataApiPositionCount = walletAddress ? await fetchPositionCount(dataBaseUrl, walletAddress, timeoutMs) : null;

  printSummary({
    name: SMOKE_NAME,
    status: 'passed',
    details: {
      gammaMarketCount: marketsPayload.length,
      clobTokenId: tokenId,
      clobHealth: clobHealthText?.slice(0, 80) ?? 'skipped',
      clobBidLevels: Array.isArray(bookPayload.bids) ? bookPayload.bids.length : 0,
      clobAskLevels: Array.isArray(bookPayload.asks) ? bookPayload.asks.length : 0,
      dataApiPositions: dataApiPositionCount ?? 'skipped',
    },
  });
}

function jsonHeaders(): RequestInit {
  return {
    headers: {
      accept: 'application/json',
      'user-agent': 'causeway-api-smoke/0.1',
    },
  };
}

function findFirstClobTokenId(markets: unknown[]): string | null {
  for (const market of markets) {
    if (!isRecord(market)) continue;
    const tokenIds = stringArrayFromUnknown(market.clobTokenIds);
    const tokenId = tokenIds.find((value) => value.trim().length > 0);
    if (tokenId) return tokenId;
  }
  return null;
}

function isOrderBookPayload(value: unknown): value is { bids?: unknown[]; asks?: unknown[] } {
  if (!isRecord(value)) return false;
  return Array.isArray(value.bids) || Array.isArray(value.asks);
}

async function fetchPositionCount(baseUrl: string, walletAddress: string, timeoutMs: number): Promise<number> {
  const positionsUrl = new URL('/positions', baseUrl);
  positionsUrl.searchParams.set('user', walletAddress);
  positionsUrl.searchParams.set('limit', '1');
  const payload = await fetchJson(positionsUrl, timeoutMs, jsonHeaders());
  if (!Array.isArray(payload)) {
    throw new Error('Data API smoke returned a non-array positions body');
  }
  return payload.length;
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ name: SMOKE_NAME, status: 'failed', error: formatUnknownError(error) }, null, 2));
  process.exitCode = 1;
});
