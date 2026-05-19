import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DEMO_SYNCED_AT = new Date('2026-05-18T00:00:00.000Z');

const demoEvent = {
  id: 'demo_event_macro_2026',
  externalEventId: 'demo_external_event_macro_2026',
  slug: 'demo-2026-macro-and-politics',
  title: '2026 Macro and Politics Demo',
  description: 'Deterministic demo event for local frontend integration.',
  tags: ['politics', 'macro', 'demo'],
};

const demoMarkets: DemoMarketInput[] = [
  {
    id: 'demo_market_rate_cut_2026',
    externalMarketId: 'demo_external_market_rate_cut_2026',
    conditionId: 'demo_condition_rate_cut_2026',
    slug: 'demo-fed-rate-cut-2026',
    question: 'Will the Fed cut rates before July 2026?',
    description: 'Demo binary market used as a root market for Causeway inference.',
    tags: ['macro', 'rates'],
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    volume: '125000',
    volume24hr: '8500',
    liquidity: '32000',
    bestBid: '0.54',
    bestAsk: '0.56',
    lastTradePrice: '0.55',
    outcomes: [
      { id: 'demo_outcome_rate_cut_yes', label: 'Yes', tokenId: 'demo_token_rate_cut_yes', price: '0.55' },
      { id: 'demo_outcome_rate_cut_no', label: 'No', tokenId: 'demo_token_rate_cut_no', price: '0.45' },
    ],
  },
  {
    id: 'demo_market_inflation_2026',
    externalMarketId: 'demo_external_market_inflation_2026',
    conditionId: 'demo_condition_inflation_2026',
    slug: 'demo-us-inflation-above-3-2026',
    question: 'Will US CPI be above 3% in June 2026?',
    description: 'Demo related macro market for local inference candidates.',
    tags: ['macro', 'inflation'],
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    volume: '98000',
    volume24hr: '6100',
    liquidity: '28000',
    bestBid: '0.41',
    bestAsk: '0.43',
    lastTradePrice: '0.42',
    outcomes: [
      { id: 'demo_outcome_inflation_yes', label: 'Yes', tokenId: 'demo_token_inflation_yes', price: '0.42' },
      { id: 'demo_outcome_inflation_no', label: 'No', tokenId: 'demo_token_inflation_no', price: '0.58' },
    ],
  },
  {
    id: 'demo_market_election_2026',
    externalMarketId: 'demo_external_market_election_2026',
    conditionId: 'demo_condition_election_2026',
    slug: 'demo-party-wins-house-2026',
    question: 'Which party will win the House in 2026?',
    description: 'Demo multi-outcome market for frontend rendering and script outcome selection.',
    tags: ['politics', 'elections'],
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    volume: '210000',
    volume24hr: '12000',
    liquidity: '54000',
    bestBid: '0.49',
    bestAsk: '0.51',
    lastTradePrice: '0.50',
    outcomes: [
      { id: 'demo_outcome_house_democratic', label: 'Democratic', tokenId: 'demo_token_house_democratic', price: '0.50' },
      { id: 'demo_outcome_house_republican', label: 'Republican', tokenId: 'demo_token_house_republican', price: '0.47' },
      { id: 'demo_outcome_house_other', label: 'Other', tokenId: 'demo_token_house_other', price: '0.03' },
    ],
  },
  {
    id: 'demo_market_crypto_2026',
    externalMarketId: 'demo_external_market_crypto_2026',
    conditionId: 'demo_condition_crypto_2026',
    slug: 'demo-btc-above-100k-2026',
    question: 'Will Bitcoin trade above $100,000 before July 2026?',
    description: 'Demo crypto market that gives the market network another category.',
    tags: ['crypto', 'macro'],
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    volume: '175000',
    volume24hr: '9300',
    liquidity: '41000',
    bestBid: '0.61',
    bestAsk: '0.63',
    lastTradePrice: '0.62',
    outcomes: [
      { id: 'demo_outcome_btc_yes', label: 'Yes', tokenId: 'demo_token_btc_yes', price: '0.62' },
      { id: 'demo_outcome_btc_no', label: 'No', tokenId: 'demo_token_btc_no', price: '0.38' },
    ],
  },
  {
    id: 'demo_market_closed_2026',
    externalMarketId: 'demo_external_market_closed_2026',
    conditionId: 'demo_condition_closed_2026',
    slug: 'demo-closed-market-2026',
    question: 'Did the demo closed market resolve Yes?',
    description: 'Demo closed market for filtering behavior.',
    tags: ['demo'],
    active: false,
    closed: true,
    acceptingOrders: false,
    enableOrderBook: false,
    volume: '5000',
    volume24hr: '0',
    liquidity: '0',
    bestBid: null,
    bestAsk: null,
    lastTradePrice: '1',
    outcomes: [
      { id: 'demo_outcome_closed_yes', label: 'Yes', tokenId: 'demo_token_closed_yes', price: '1' },
      { id: 'demo_outcome_closed_no', label: 'No', tokenId: 'demo_token_closed_no', price: '0' },
    ],
  },
];

export async function seedDemoData(prisma: PrismaClient): Promise<DemoSeedResult> {
  await prisma.$transaction(async (tx) => {
    await upsertDemoEvent(tx);
    for (const market of demoMarkets) {
      await upsertDemoMarket(tx, market);
      for (const [index, outcome] of market.outcomes.entries()) {
        await upsertDemoOutcome(tx, market, outcome, index);
      }
    }
    await upsertDemoNetwork(tx);
  });

  return {
    eventId: demoEvent.id,
    activeMarketCount: demoMarkets.filter((market) => market.active && !market.closed).length,
    outcomeCount: demoMarkets.reduce((sum, market) => sum + market.outcomes.length, 0),
    rootMarketSlug: 'demo-fed-rate-cut-2026',
    rootOutcomeId: 'demo_outcome_rate_cut_yes',
    mockModel: 'mock-causeway-v1',
  };
}

async function upsertDemoEvent(tx: Prisma.TransactionClient): Promise<void> {
  await tx.polymarketEvent.upsert({
    where: { id: demoEvent.id },
    update: {
      title: demoEvent.title,
      description: demoEvent.description,
      tags: toJson(demoEvent.tags),
      active: true,
      closed: false,
      archived: false,
      restricted: false,
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      volume: '613000',
      liquidity: '155000',
      openInterest: '76000',
      rawPayload: toJson({ source: 'demo_seed', externalEventId: demoEvent.externalEventId }),
      syncedAt: DEMO_SYNCED_AT,
    },
    create: {
      id: demoEvent.id,
      externalEventId: demoEvent.externalEventId,
      slug: demoEvent.slug,
      title: demoEvent.title,
      description: demoEvent.description,
      image: null,
      icon: null,
      tags: toJson(demoEvent.tags),
      active: true,
      closed: false,
      archived: false,
      restricted: false,
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      volume: '613000',
      liquidity: '155000',
      openInterest: '76000',
      rawPayload: toJson({ source: 'demo_seed', externalEventId: demoEvent.externalEventId }),
      syncedAt: DEMO_SYNCED_AT,
    },
  });
}

async function upsertDemoMarket(tx: Prisma.TransactionClient, market: DemoMarketInput): Promise<void> {
  await tx.polymarketMarket.upsert({
    where: { id: market.id },
    update: {
      eventId: demoEvent.id,
      externalMarketId: market.externalMarketId,
      conditionId: market.conditionId,
      questionId: `${market.id}_question`,
      slug: market.slug,
      question: market.question,
      description: market.description,
      rules: 'Demo market rules for local frontend integration.',
      active: market.active,
      closed: market.closed,
      archived: false,
      acceptingOrders: market.acceptingOrders,
      enableOrderBook: market.enableOrderBook,
      negRisk: false,
      orderMinSize: '1',
      orderPriceMinTickSize: '0.01',
      bestBid: market.bestBid,
      bestAsk: market.bestAsk,
      lastTradePrice: market.lastTradePrice,
      spread: market.bestBid && market.bestAsk ? String(Number(market.bestAsk) - Number(market.bestBid)) : null,
      volume: market.volume,
      volume24hr: market.volume24hr,
      liquidity: market.liquidity,
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      rawPayload: toJson({ source: 'demo_seed', tags: market.tags }),
      syncedAt: DEMO_SYNCED_AT,
    },
    create: {
      id: market.id,
      eventId: demoEvent.id,
      externalMarketId: market.externalMarketId,
      conditionId: market.conditionId,
      questionId: `${market.id}_question`,
      slug: market.slug,
      question: market.question,
      description: market.description,
      rules: 'Demo market rules for local frontend integration.',
      image: null,
      icon: null,
      active: market.active,
      closed: market.closed,
      archived: false,
      acceptingOrders: market.acceptingOrders,
      enableOrderBook: market.enableOrderBook,
      negRisk: false,
      orderMinSize: '1',
      orderPriceMinTickSize: '0.01',
      bestBid: market.bestBid,
      bestAsk: market.bestAsk,
      lastTradePrice: market.lastTradePrice,
      spread: market.bestBid && market.bestAsk ? String(Number(market.bestAsk) - Number(market.bestBid)) : null,
      volume: market.volume,
      volume24hr: market.volume24hr,
      liquidity: market.liquidity,
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      rawPayload: toJson({ source: 'demo_seed', tags: market.tags }),
      syncedAt: DEMO_SYNCED_AT,
    },
  });
}

async function upsertDemoOutcome(
  tx: Prisma.TransactionClient,
  market: DemoMarketInput,
  outcome: DemoOutcomeInput,
  outcomeIndex: number,
): Promise<void> {
  await tx.polymarketOutcome.upsert({
    where: { id: outcome.id },
    update: {
      marketId: market.id,
      outcomeIndex,
      label: outcome.label,
      clobTokenId: outcome.tokenId,
      price: outcome.price,
      bestBid: outcome.price,
      bestAsk: outcome.price,
      lastTradePrice: outcome.price,
      rawPayload: toJson({ source: 'demo_seed', clobTokenId: outcome.tokenId }),
      syncedAt: DEMO_SYNCED_AT,
    },
    create: {
      id: outcome.id,
      marketId: market.id,
      outcomeIndex,
      label: outcome.label,
      clobTokenId: outcome.tokenId,
      price: outcome.price,
      bestBid: outcome.price,
      bestAsk: outcome.price,
      lastTradePrice: outcome.price,
      rawPayload: toJson({ source: 'demo_seed', clobTokenId: outcome.tokenId }),
      syncedAt: DEMO_SYNCED_AT,
    },
  });
}

async function upsertDemoNetwork(tx: Prisma.TransactionClient): Promise<void> {
  for (const [index, market] of demoMarkets.filter((item) => item.active && !item.closed).entries()) {
    await tx.marketNetworkNode.upsert({
      where: { marketId: market.id },
      update: {
        score: String(100 - index * 10),
        category: market.tags[0] ?? null,
        metadata: toJson({ source: 'demo_seed' }),
        computedAt: DEMO_SYNCED_AT,
      },
      create: {
        marketId: market.id,
        score: String(100 - index * 10),
        category: market.tags[0] ?? null,
        metadata: toJson({ source: 'demo_seed' }),
        computedAt: DEMO_SYNCED_AT,
      },
    });
  }

  const [root, ...related] = demoMarkets.filter((item) => item.active && !item.closed);
  if (!root) return;
  for (const market of related) {
    await tx.marketNetworkEdge.upsert({
      where: {
        sourceMarketId_targetMarketId_relationType: {
          sourceMarketId: root.id,
          targetMarketId: market.id,
          relationType: 'event',
        },
      },
      update: {
        weight: '0.8',
        metadata: toJson({ source: 'demo_seed' }),
        computedAt: DEMO_SYNCED_AT,
      },
      create: {
        sourceMarketId: root.id,
        targetMarketId: market.id,
        relationType: 'event',
        weight: '0.8',
        metadata: toJson({ source: 'demo_seed' }),
        computedAt: DEMO_SYNCED_AT,
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

type DemoMarketInput = {
  id: string;
  externalMarketId: string;
  conditionId: string;
  slug: string;
  question: string;
  description: string;
  tags: string[];
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  volume: string;
  volume24hr: string;
  liquidity: string;
  bestBid: string | null;
  bestAsk: string | null;
  lastTradePrice: string | null;
  outcomes: DemoOutcomeInput[];
};

type DemoOutcomeInput = {
  id: string;
  label: string;
  tokenId: string;
  price: string;
};

export type DemoSeedResult = {
  eventId: string;
  activeMarketCount: number;
  outcomeCount: number;
  rootMarketSlug: string;
  rootOutcomeId: string;
  mockModel: string;
};

async function main(): Promise<void> {
  loadLocalEnv();
  assertSafeSeedTarget();
  const prisma = new PrismaClient();
  try {
    const result = await seedDemoData(prisma);
    console.log(JSON.stringify({ status: 'ok', ...result }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

function loadLocalEnv(): void {
  if (process.env.DATABASE_URL) return;

  const envPath = [join(process.cwd(), '.env'), join(process.cwd(), '.env.example')].find((filePath) => existsSync(filePath));
  if (!envPath) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [name, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim();
    if (name && !process.env[name]) {
      process.env[name] = value;
    }
  }
}

function assertSafeSeedTarget(): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED_IN_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed demo data in production without ALLOW_DEMO_SEED_IN_PRODUCTION=true');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for demo seed');
  }
}
