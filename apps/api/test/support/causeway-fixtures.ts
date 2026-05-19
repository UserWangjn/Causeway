import { Prisma, type PrismaClient } from '@prisma/client';

export const fixtureIds = {
  user1: 'user_1',
  user2: 'user_2',
  eventElection: 'event_election',
  marketBinary: 'market_binary',
  marketMultiOutcome: 'market_multi_outcome',
  marketClosed: 'market_closed',
  marketNotTradable: 'market_not_tradable',
  binaryYes: 'outcome_binary_yes',
  binaryNo: 'outcome_binary_no',
  multiA: 'outcome_multi_a',
  multiB: 'outcome_multi_b',
  multiC: 'outcome_multi_c',
  inferenceRun1: 'inference_run_1',
  script1: 'script_1',
  scriptMarket1: 'script_market_1',
  selectionYes: 'selection_yes',
  selectionNo: 'selection_no',
  intent1: 'intent_1',
  order1: 'order_1',
  submission1: 'submission_1',
} as const;

export async function seedCausewayFixture(prisma: PrismaClient) {
  const now = new Date('2026-05-18T00:00:00.000Z');

  const user1 = await prisma.user.create({
    data: {
      id: fixtureIds.user1,
      walletAddress: '0x1111111111111111111111111111111111111111',
    },
  });
  const user2 = await prisma.user.create({
    data: {
      id: fixtureIds.user2,
      walletAddress: '0x2222222222222222222222222222222222222222',
    },
  });

  await prisma.walletSession.create({
    data: {
      id: 'wallet_session_1',
      userId: user1.id,
      address: user1.walletAddress,
      chainId: 137,
      nonce: 'fixture_nonce_1',
      nonceExpiresAt: new Date('2026-05-18T00:10:00.000Z'),
      verifiedAt: now,
      sessionTokenHash: 'fixture_token_hash',
      sessionExpiresAt: new Date('2026-05-25T00:00:00.000Z'),
    },
  });

  const event = await prisma.polymarketEvent.create({
    data: {
      id: fixtureIds.eventElection,
      externalEventId: 'external_event_election',
      slug: 'fixture-election',
      title: 'Fixture Election Event',
      description: 'Fixture event for backend tests',
      image: null,
      icon: null,
      tags: toJson(['politics', 'fixture']),
      active: true,
      closed: false,
      archived: false,
      restricted: false,
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      volume: '1000',
      liquidity: '500',
      openInterest: '250',
      rawPayload: toJson({ id: 'external_event_election' }),
      syncedAt: now,
    },
  });

  const marketBinary = await createMarket(prisma, {
    id: fixtureIds.marketBinary,
    eventId: event.id,
    externalMarketId: 'external_market_binary',
    conditionId: 'condition_binary',
    slug: 'fixture-binary-market',
    question: 'Will the fixture binary market resolve Yes?',
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
  });
  const marketMultiOutcome = await createMarket(prisma, {
    id: fixtureIds.marketMultiOutcome,
    eventId: event.id,
    externalMarketId: 'external_market_multi',
    conditionId: 'condition_multi',
    slug: 'fixture-multi-market',
    question: 'Which fixture candidate will win?',
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
  });
  await createMarket(prisma, {
    id: fixtureIds.marketClosed,
    eventId: event.id,
    externalMarketId: 'external_market_closed',
    conditionId: 'condition_closed',
    slug: 'fixture-closed-market',
    question: 'Will the fixture closed market resolve Yes?',
    active: false,
    closed: true,
    acceptingOrders: false,
    enableOrderBook: false,
  });
  await createMarket(prisma, {
    id: fixtureIds.marketNotTradable,
    eventId: event.id,
    externalMarketId: 'external_market_not_tradable',
    conditionId: 'condition_not_tradable',
    slug: 'fixture-not-tradable-market',
    question: 'Will the fixture not tradable market resolve Yes?',
    active: true,
    closed: false,
    acceptingOrders: false,
    enableOrderBook: false,
  });

  const binaryYes = await createOutcome(prisma, {
    id: fixtureIds.binaryYes,
    marketId: marketBinary.id,
    outcomeIndex: 0,
    label: 'Yes',
    clobTokenId: 'token_binary_yes',
    price: '0.55',
  });
  const binaryNo = await createOutcome(prisma, {
    id: fixtureIds.binaryNo,
    marketId: marketBinary.id,
    outcomeIndex: 1,
    label: 'No',
    clobTokenId: 'token_binary_no',
    price: '0.45',
  });
  await createOutcome(prisma, {
    id: fixtureIds.multiA,
    marketId: marketMultiOutcome.id,
    outcomeIndex: 0,
    label: 'Candidate A',
    clobTokenId: 'token_multi_a',
    price: '0.20',
  });
  await createOutcome(prisma, {
    id: fixtureIds.multiB,
    marketId: marketMultiOutcome.id,
    outcomeIndex: 1,
    label: 'Candidate B',
    clobTokenId: 'token_multi_b',
    price: '0.35',
  });
  await createOutcome(prisma, {
    id: fixtureIds.multiC,
    marketId: marketMultiOutcome.id,
    outcomeIndex: 2,
    label: 'Candidate C',
    clobTokenId: 'token_multi_c',
    price: '0.45',
  });

  const inferenceRun = await prisma.inferenceRun.create({
    data: {
      id: fixtureIds.inferenceRun1,
      userId: user1.id,
      rootMarketId: marketBinary.id,
      rootOutcomeId: binaryYes.id,
      rootClobTokenId: binaryYes.clobTokenId,
      depth: 1,
      maxMarketsPerLayer: 2,
      confidenceThreshold: '0.5',
      model: 'fixture-model',
      promptVersion: 'fixture-v1',
      outputSchemaVersion: 'fixture-v1',
      cacheEnabled: true,
      cacheKey: 'fixture-cache-key',
      status: 'completed',
      progress: 100,
      inputJson: toJson({ rootMarketId: marketBinary.id }),
      outputJson: toJson({ script: fixtureIds.script1 }),
      completedAt: now,
    },
  });

  const script = await prisma.causalScript.create({
    data: {
      id: fixtureIds.script1,
      userId: user1.id,
      inferenceRunId: inferenceRun.id,
      title: 'Fixture causal script',
      status: 'draft',
      rootMarketId: marketBinary.id,
      rootOutcomeId: binaryYes.id,
      graphJson: toJson({ nodes: [], edges: [] }),
      summary: 'Fixture script summary',
    },
  });

  const scriptMarket = await prisma.scriptMarket.create({
    data: {
      id: fixtureIds.scriptMarket1,
      scriptId: script.id,
      marketId: marketBinary.id,
      layer: 0,
      impactDirection: 'supports',
      confidence: '0.8',
      reason: 'Fixture causal reason',
      metadata: toJson({ fixture: true }),
    },
  });

  const selectionYes = await prisma.scriptOutcomeSelection.create({
    data: {
      id: fixtureIds.selectionYes,
      scriptMarketId: scriptMarket.id,
      outcomeId: binaryYes.id,
      aiAction: 'buy',
      userAction: 'buy',
      orderMode: 'limit',
      limitPrice: '0.55',
      amountUsd: '10',
      confidence: '0.8',
      reason: 'Fixture buy reason',
    },
  });
  await prisma.scriptOutcomeSelection.create({
    data: {
      id: fixtureIds.selectionNo,
      scriptMarketId: scriptMarket.id,
      outcomeId: binaryNo.id,
      aiAction: 'avoid',
      userAction: 'skip',
      orderMode: 'limit',
      limitPrice: '0.45',
      amountUsd: '0',
      confidence: '0.2',
      reason: 'Fixture skip reason',
    },
  });

  const intent = await prisma.orderIntent.create({
    data: {
      id: fixtureIds.intent1,
      userId: user1.id,
      scriptId: script.id,
      status: 'preview_ready',
      executionMode: 'dry_run',
      totalAmountUsd: '10',
      tradingCapability: 'degraded',
      tradingCapabilityReason: 'fixture dry run',
      balanceCapability: 'unavailable',
      balanceCapabilityReason: 'fixture no balance source',
      previewJson: toJson({ fixture: true }),
      riskJson: toJson({ valid: true }),
      previewExpiresAt: new Date('2026-05-18T00:01:00.000Z'),
    },
  });
  await prisma.causewayOrder.create({
    data: {
      id: fixtureIds.order1,
      orderIntentId: intent.id,
      selectionId: selectionYes.id,
      marketId: marketBinary.id,
      outcomeId: binaryYes.id,
      clobTokenId: binaryYes.clobTokenId,
      side: 'BUY',
      orderMode: 'limit',
      orderType: 'GTC',
      limitPrice: '0.55',
      estimatedFillPrice: '0.55',
      size: '18.181818',
      amountUsd: '10',
      status: 'preview_ready',
      submitPayload: toJson({ fixture: true }),
    },
  });
  await prisma.orderSubmission.create({
    data: {
      id: fixtureIds.submission1,
      userId: user1.id,
      orderIntentId: intent.id,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      requestHash: 'fixture-request-hash',
      status: 'dry_run_completed',
      responseJson: toJson({ status: 'dry_run_completed' }),
    },
  });

  return {
    user1,
    user2,
    event,
    marketBinary,
    marketMultiOutcome,
    binaryYes,
    binaryNo,
    inferenceRun,
    script,
    scriptMarket,
    selectionYes,
    intent,
  };
}

type MarketInput = {
  id: string;
  eventId: string;
  externalMarketId: string;
  conditionId: string;
  slug: string;
  question: string;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
};

async function createMarket(prisma: PrismaClient, input: MarketInput) {
  return prisma.polymarketMarket.create({
    data: {
      id: input.id,
      eventId: input.eventId,
      externalMarketId: input.externalMarketId,
      conditionId: input.conditionId,
      questionId: `${input.id}_question`,
      slug: input.slug,
      question: input.question,
      description: `${input.question} description`,
      rules: 'Fixture market rules',
      image: null,
      icon: null,
      active: input.active,
      closed: input.closed,
      archived: false,
      acceptingOrders: input.acceptingOrders,
      enableOrderBook: input.enableOrderBook,
      negRisk: false,
      orderMinSize: '1',
      orderPriceMinTickSize: '0.01',
      bestBid: '0.54',
      bestAsk: '0.56',
      lastTradePrice: '0.55',
      spread: '0.02',
      volume: '100',
      volume24hr: '10',
      liquidity: '50',
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      rawPayload: toJson({ id: input.externalMarketId }),
      syncedAt: new Date('2026-05-18T00:00:00.000Z'),
    },
  });
}

type OutcomeInput = {
  id: string;
  marketId: string;
  outcomeIndex: number;
  label: string;
  clobTokenId: string;
  price: string;
};

async function createOutcome(prisma: PrismaClient, input: OutcomeInput) {
  return prisma.polymarketOutcome.create({
    data: {
      id: input.id,
      marketId: input.marketId,
      outcomeIndex: input.outcomeIndex,
      label: input.label,
      clobTokenId: input.clobTokenId,
      price: input.price,
      bestBid: input.price,
      bestAsk: input.price,
      lastTradePrice: input.price,
      rawPayload: toJson({ clobTokenId: input.clobTokenId }),
      syncedAt: new Date('2026-05-18T00:00:00.000Z'),
    },
  });
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
