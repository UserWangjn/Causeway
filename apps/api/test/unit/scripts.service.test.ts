import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import type { PrismaService } from '../../src/database/prisma.service';
import { ScriptsService } from '../../src/modules/scripts/scripts.service';

describe('ScriptsService', () => {
  it('lists the authenticated user scripts from persisted causal scripts', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'script_1',
        title: 'Causeway script: root question',
        status: 'draft',
        summary: 'summary',
        rootMarketId: 'market_1',
        rootOutcomeId: 'outcome_yes',
        createdAt: new Date('2026-05-18T00:00:00.000Z'),
        updatedAt: new Date('2026-05-18T00:01:00.000Z'),
        markets: [
          {
            market: {
              question: 'Will real market resolve Yes?',
              eventId: 'event_1',
              event: {
                id: 'event_1',
                slug: 'fixture-event',
                title: 'Fixture Event',
              },
              icon: 'icon.png',
              image: 'image.png',
              bestAsk: '0.42',
              lastTradePrice: '0.41',
              volume: '1000',
              volume24hr: '250',
              liquidity: '500',
            },
          },
        ],
        _count: {
          markets: 3,
          orderIntents: 1,
        },
      },
    ]);
    const polymarketOutcomeFindMany = vi.fn().mockResolvedValue([
      {
        id: 'outcome_yes',
        label: 'Yes',
        clobTokenId: 'token_yes',
        price: '0.40',
        bestBid: '0.39',
        bestAsk: '0.42',
        lastTradePrice: '0.41',
      },
    ]);
    const service = new ScriptsService({
      causalScript: {
        findMany,
      },
      polymarketOutcome: {
        findMany: polymarketOutcomeFindMany,
      },
    } as unknown as PrismaService);

    const result = await service.listScripts(currentUser(), { limit: 10 });

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 11,
      select: expect.objectContaining({
        id: true,
        rootMarketId: true,
        markets: expect.any(Object) as object,
        _count: expect.any(Object) as object,
      }) as object,
    });
    expect(polymarketOutcomeFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['outcome_yes'] } },
      select: expect.any(Object) as object,
    });
    expect(result).toEqual({
      items: [
        {
          id: 'script_1',
          title: 'Will real market resolve Yes?',
          rootEventId: 'event_1',
          rootEventSlug: 'fixture-event',
          rootEventTitle: 'Fixture Event',
          status: 'draft',
          summary: 'summary',
          rootMarketId: 'market_1',
          rootOutcomeId: 'outcome_yes',
          rootOutcomeLabel: 'Yes',
          rootPrice: 0.42,
          rootVolume: 1000,
          rootVolume24hr: 250,
          rootLiquidity: 500,
          icon: 'icon.png',
          image: 'image.png',
          marketCount: 3,
          orderIntentCount: 1,
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:01:00.000Z',
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
  });

  it('applies script list status, search, and cursor filters in the database query', async () => {
    const cursor = Buffer.from(JSON.stringify({
      v: 1,
      scope: 'scripts',
      id: 'script_cursor',
      q: 'UFC',
      status: 'active',
      timestamp: '2026-05-18T00:00:00.000Z',
    }), 'utf8').toString('base64url');
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new ScriptsService({
      causalScript: {
        findMany,
      },
      polymarketOutcome: {
        findMany: vi.fn(),
      },
    } as unknown as PrismaService);

    await service.listScripts(currentUser(), { limit: 5, status: 'active', q: ' UFC ', cursor });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { userId: 'user_1', status: 'active' },
          {
            OR: expect.arrayContaining([
              { title: { contains: 'UFC', mode: 'insensitive' } },
              { summary: { contains: 'UFC', mode: 'insensitive' } },
              { rootMarketId: 'UFC' },
            ]) as object[],
          },
          {
            OR: [
              { createdAt: { lt: new Date('2026-05-18T00:00:00.000Z') } },
              {
                AND: [
                  { createdAt: new Date('2026-05-18T00:00:00.000Z') },
                  { id: { gt: 'script_cursor' } },
                ],
              },
            ],
          },
        ],
      },
      take: 6,
    }));
  });

  it('returns a script in the public API contract shape', async () => {
    const causalScriptFindFirst = vi.fn().mockResolvedValue({
      id: 'script_1',
      title: 'Script one',
      status: 'draft',
      rootMarketId: 'market_1',
      rootOutcomeId: 'outcome_yes',
      graphJson: {
        root: {
          marketId: 'market_1',
          outcomeId: 'outcome_yes',
          outcomeLabel: 'Yes',
        },
        nodes: [
          {
            nodeId: 'root',
            marketId: 'market_1',
            layer: 0,
            recommendedOutcomes: [
              {
                outcomeId: 'outcome_yes',
                label: 'Yes',
              },
            ],
            confidence: 1,
            direction: 'supports',
          },
        ],
        edges: [],
      },
      summary: 'summary',
      createdAt: new Date('2026-05-18T00:00:00.000Z'),
      updatedAt: new Date('2026-05-18T00:01:00.000Z'),
      inferenceRun: {
        id: 'run_1',
        status: 'completed',
        stage: 'script_generation',
        progress: 100,
        cacheHit: false,
        model: 'deepseek-v4-flash',
        errorMessage: null,
        createdAt: new Date('2026-05-18T00:00:00.000Z'),
        completedAt: new Date('2026-05-18T00:00:30.000Z'),
      },
      markets: [
        {
          id: 'script_market_1',
          marketId: 'market_1',
          layer: 0,
          impactDirection: 'supports',
          confidence: '1',
          reason: 'market reason',
          market: {
            question: 'Will market one resolve Yes?',
            eventId: 'event_1',
            event: {
              id: 'event_1',
              slug: 'fixture-event',
              title: 'Fixture Event',
            },
            active: true,
            closed: false,
            archived: false,
            staleDetectedAt: null,
            acceptingOrders: true,
            enableOrderBook: true,
            icon: 'icon.png',
            image: 'image.png',
            orderMinSize: '5',
            orderPriceMinTickSize: '0.01',
            bestAsk: '0.42',
            lastTradePrice: '0.39',
            volume: '1000',
            volume24hr: '250',
            liquidity: '500',
            outcomes: [
              {
                id: 'outcome_yes',
                label: 'Yes',
                clobTokenId: 'token_yes',
                price: '0.41',
                bestBid: '0.4',
                bestAsk: '0.42',
                lastTradePrice: '0.39',
              },
            ],
          },
          selections: [
            {
              id: 'selection_1',
              outcomeId: 'outcome_yes',
              aiAction: 'buy',
              userAction: 'buy',
              side: 'BUY',
              orderMode: 'limit',
              limitPrice: '0.42',
              size: null,
              amountUsd: '25',
              confidence: '0.91',
              reason: 'reason',
              outcome: {
                id: 'outcome_yes',
                label: 'Yes',
                clobTokenId: 'token_yes',
                price: '0.41',
                bestBid: '0.4',
                bestAsk: '0.42',
                lastTradePrice: '0.39',
              },
            },
          ],
        },
      ],
    });
    const service = new ScriptsService({
      causalScript: {
        findFirst: causalScriptFindFirst,
      },
    } as unknown as PrismaService);

    const result = await service.getScript(currentUser(), 'script_1');

    expect(causalScriptFindFirst).toHaveBeenCalledWith({
      where: { id: 'script_1', userId: 'user_1' },
      select: {
        id: true,
        title: true,
        status: true,
        rootMarketId: true,
        rootOutcomeId: true,
        graphJson: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
        inferenceRun: {
          select: {
            id: true,
            status: true,
            stage: true,
            progress: true,
            cacheHit: true,
            model: true,
            errorMessage: true,
            createdAt: true,
            completedAt: true,
          },
        },
        markets: {
          orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            marketId: true,
            layer: true,
            impactDirection: true,
            confidence: true,
            reason: true,
            market: {
              select: {
                question: true,
                eventId: true,
                event: {
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                  },
                },
                active: true,
                closed: true,
                archived: true,
                staleDetectedAt: true,
                acceptingOrders: true,
                enableOrderBook: true,
                icon: true,
                image: true,
                orderMinSize: true,
                orderPriceMinTickSize: true,
                bestAsk: true,
                lastTradePrice: true,
                volume: true,
                volume24hr: true,
                liquidity: true,
                outcomes: {
                  orderBy: { outcomeIndex: 'asc' },
                  select: {
                    id: true,
                    label: true,
                    clobTokenId: true,
                    price: true,
                    bestBid: true,
                    bestAsk: true,
                    lastTradePrice: true,
                  },
                },
              },
            },
            selections: {
              orderBy: { outcomeId: 'asc' },
              select: {
                id: true,
                outcomeId: true,
                aiAction: true,
                userAction: true,
                side: true,
                orderMode: true,
                limitPrice: true,
                size: true,
                amountUsd: true,
                confidence: true,
                reason: true,
                outcome: {
                  select: {
                    id: true,
                    label: true,
                    clobTokenId: true,
                    price: true,
                    bestBid: true,
                    bestAsk: true,
                    lastTradePrice: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(result).toMatchObject({
      id: 'script_1',
      root: {
        marketId: 'market_1',
        outcomeId: 'outcome_yes',
        outcomeLabel: 'Yes',
      },
      graph: {
        nodes: [
          {
            nodeId: 'root',
            marketId: 'market_1',
            title: 'Will market one resolve Yes?',
              recommendedOutcomes: [
                {
                  outcomeId: 'outcome_yes',
                  label: 'Yes',
                  tokenId: 'token_yes',
                },
              ],
              price: 0.42,
            },
          ],
        edges: [],
      },
      inferenceRun: {
        id: 'run_1',
        status: 'completed',
        stage: 'script_generation',
        progress: 100,
        cacheHit: false,
        model: 'deepseek-v4-flash',
        errorMessage: null,
        createdAt: '2026-05-18T00:00:00.000Z',
        completedAt: '2026-05-18T00:00:30.000Z',
      },
      markets: [
        {
          scriptMarketId: 'script_market_1',
          marketId: 'market_1',
            title: 'Will market one resolve Yes?',
            eventId: 'event_1',
            eventSlug: 'fixture-event',
            eventTitle: 'Fixture Event',
            active: true,
            closed: false,
            archived: false,
            staleDetectedAt: null,
            acceptingOrders: true,
            enableOrderBook: true,
            orderMinSize: 5,
          tickSize: 0.01,
          impactDirection: 'supports',
          reason: 'market reason',
          icon: 'icon.png',
          image: 'image.png',
          volume: 1000,
          volume24hr: 250,
          liquidity: 500,
          outcomes: [
            {
              selectionId: 'selection_1',
              outcomeId: 'outcome_yes',
              label: 'Yes',
              tokenId: 'token_yes',
              price: 0.42,
              userAction: 'buy',
              side: 'BUY',
              orderMode: 'limit',
              limitPrice: 0.42,
              amountUsd: 25,
              confidence: 0.91,
            },
          ],
        },
      ],
    });
  });

  it('creates a direct order script from a selected market outcome', async () => {
    const market = {
      id: 'market_1',
      eventId: 'event_1',
      question: 'Will market one resolve Yes?',
      active: true,
      closed: false,
      archived: false,
      acceptingOrders: true,
      enableOrderBook: true,
      staleDetectedAt: null,
      orderMinSize: '5',
      orderPriceMinTickSize: '0.01',
      bestAsk: '0.43',
      lastTradePrice: '0.41',
      outcomes: [
        {
          id: 'outcome_yes',
          label: 'Yes',
          clobTokenId: 'token_yes',
          price: '0.41',
          bestBid: '0.4',
          bestAsk: '0.42',
          lastTradePrice: '0.39',
        },
      ],
    };
    const scriptForGet = {
      id: 'script_direct',
      title: 'Order: Will market one resolve Yes?',
      status: 'draft',
      rootMarketId: 'market_1',
      rootOutcomeId: 'outcome_yes',
      graphJson: {
        root: {
          marketId: 'market_1',
          outcomeId: 'outcome_yes',
          outcomeLabel: 'Yes',
        },
        nodes: [],
        edges: [],
      },
      summary: 'Manual order draft for Yes.',
      createdAt: new Date('2026-05-18T00:00:00.000Z'),
      updatedAt: new Date('2026-05-18T00:01:00.000Z'),
      inferenceRun: {
        id: 'run_direct',
        status: 'completed',
        stage: 'script_generation',
        progress: 100,
        cacheHit: false,
        model: 'manual-order',
        errorMessage: null,
        createdAt: new Date('2026-05-18T00:00:00.000Z'),
        completedAt: new Date('2026-05-18T00:00:30.000Z'),
      },
      markets: [
        {
          id: 'script_market_1',
          marketId: 'market_1',
          layer: 0,
          confidence: '1',
          market: {
            question: 'Will market one resolve Yes?',
            orderMinSize: '5',
            orderPriceMinTickSize: '0.01',
            bestAsk: '0.43',
            lastTradePrice: '0.41',
            outcomes: market.outcomes,
          },
          selections: [
            {
              id: 'selection_1',
              outcomeId: 'outcome_yes',
              aiAction: 'buy',
              userAction: 'buy',
              side: 'BUY',
              orderMode: 'market',
              limitPrice: null,
              size: null,
              amountUsd: '10',
              confidence: '1',
              reason: 'User selected this outcome from the market detail page.',
              outcome: market.outcomes[0],
            },
          ],
        },
      ],
    };
    const causalScriptCreate = vi.fn().mockResolvedValue({ id: 'script_direct' });
    const auditCreate = vi.fn();
    const tx = {
      inferenceRun: {
        create: vi.fn().mockResolvedValue({ id: 'run_direct' }),
      },
      causalScript: {
        create: causalScriptCreate,
      },
      auditEvent: {
        create: auditCreate,
      },
    };
    const service = new ScriptsService({
      polymarketMarket: {
        findFirst: vi.fn().mockResolvedValue(market),
      },
      causalScript: {
        findFirst: vi.fn().mockResolvedValue(scriptForGet),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService);

    const result = await service.createDirectOrderScript(currentUser('req_direct'), {
      marketId: 'market_1',
      outcomeId: 'outcome_yes',
      orderMode: 'market',
      amountUsd: 10,
    });

    expect(causalScriptCreate).toHaveBeenCalledTimes(1);
    expect(causalScriptCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        userId: 'user_1',
        inferenceRunId: 'run_direct',
        rootMarketId: 'market_1',
        rootOutcomeId: 'outcome_yes',
        markets: {
          create: [
            {
              marketId: 'market_1',
              selections: {
                create: [
                  {
                    outcomeId: 'outcome_yes',
                    userAction: 'buy',
                    orderMode: 'market',
                    amountUsd: 10,
                  },
                ],
              },
            },
          ],
        },
      },
      select: { id: true },
    });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        requestId: 'req_direct',
        action: 'script.direct_order_created',
      },
    });
    expect(result).toMatchObject({
      id: 'script_direct',
      markets: [
        {
          marketId: 'market_1',
          tickSize: 0.01,
          orderMinSize: 5,
          outcomes: [
            {
              selectionId: 'selection_1',
              outcomeId: 'outcome_yes',
              orderMode: 'market',
              amountUsd: 10,
            },
          ],
        },
      ],
    });
  });

  it('writes an audit event when a user patches an outcome selection', async () => {
    const existingSelection = {
      id: 'selection_1',
      userAction: 'skip',
      orderMode: 'limit',
      limitPrice: '0.40',
      size: null,
      amountUsd: '0',
      reason: 'before',
    };
    const updatedSelection = {
      id: 'selection_1',
      userAction: 'buy',
      orderMode: 'limit',
      limitPrice: '0.42',
      size: null,
      amountUsd: '25',
      reason: 'after',
      updatedAt: new Date('2026-05-18T00:00:00.000Z'),
    };
    const auditCreate = vi.fn();
    const tx = {
      scriptOutcomeSelection: {
        update: vi.fn().mockResolvedValue(updatedSelection),
      },
      auditEvent: {
        create: auditCreate,
      },
    };
    const service = new ScriptsService({
      scriptOutcomeSelection: {
        findFirst: vi.fn().mockResolvedValue(existingSelection),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService);

    const result = await service.updateOutcomeSelection(currentUser('req_script_1'), 'script_1', 'selection_1', {
      userAction: 'buy',
      orderMode: 'limit',
      limitPrice: 0.42,
      amountUsd: 25,
      reason: 'after',
    });

    expect(result).toMatchObject({
      selectionId: 'selection_1',
      userAction: 'buy',
      orderMode: 'limit',
      limitPrice: 0.42,
      amountUsd: 25,
      reason: 'after',
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        requestId: 'req_script_1',
        actorType: 'user',
        entityType: 'script_outcome_selection',
        entityId: 'selection_1',
        action: 'selection.updated',
        before: {
          userAction: 'skip',
          orderMode: 'limit',
          limitPrice: 0.4,
          size: null,
          amountUsd: 0,
          reason: 'before',
        },
        after: {
          userAction: 'buy',
          orderMode: 'limit',
          limitPrice: 0.42,
          size: null,
          amountUsd: 25,
          reason: 'after',
        },
      },
    });
  });

  it('rejects a buy limit selection that would not have a limit price', async () => {
    const transaction = vi.fn();
    const service = new ScriptsService({
      scriptOutcomeSelection: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'selection_1',
          userAction: 'skip',
          orderMode: 'limit',
          limitPrice: null,
          size: null,
          amountUsd: '0',
          reason: null,
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(
      service.updateOutcomeSelection(currentUser(), 'script_1', 'selection_1', {
        userAction: 'buy',
        amountUsd: 25,
      }),
    ).rejects.toThrow('Limit order selections require a valid limitPrice');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('clears the stale limit price when a selection is changed to market mode', async () => {
    const updatedSelection = {
      id: 'selection_1',
      userAction: 'buy',
      orderMode: 'market',
      limitPrice: null,
      size: null,
      amountUsd: '30',
      reason: 'market buy',
      updatedAt: new Date('2026-05-18T00:00:00.000Z'),
    };
    const update = vi.fn().mockResolvedValue(updatedSelection);
    const auditCreate = vi.fn();
    const tx = {
      scriptOutcomeSelection: {
        update,
      },
      auditEvent: {
        create: auditCreate,
      },
    };
    const service = new ScriptsService({
      scriptOutcomeSelection: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'selection_1',
          userAction: 'buy',
          orderMode: 'limit',
          limitPrice: '0.45',
          size: null,
          amountUsd: '20',
          reason: 'limit buy',
        }),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService);

    const result = await service.updateOutcomeSelection(currentUser(), 'script_1', 'selection_1', {
      orderMode: 'market',
      amountUsd: 30,
      reason: 'market buy',
    });

    expect(result).toMatchObject({
      selectionId: 'selection_1',
      orderMode: 'market',
      limitPrice: null,
      amountUsd: 30,
      reason: 'market buy',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'selection_1' },
      data: {
        userAction: 'buy',
        orderMode: 'market',
        limitPrice: null,
        size: null,
        amountUsd: 30,
        reason: 'market buy',
      },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        actorType: 'user',
        entityType: 'script_outcome_selection',
        entityId: 'selection_1',
        action: 'selection.updated',
        before: {
          userAction: 'buy',
          orderMode: 'limit',
          limitPrice: 0.45,
          size: null,
          amountUsd: 20,
          reason: 'limit buy',
        },
        after: {
          userAction: 'buy',
          orderMode: 'market',
          limitPrice: null,
          size: null,
          amountUsd: 30,
          reason: 'market buy',
        },
      },
    });
  });
});

function currentUser(requestId?: string): CurrentUser {
  return {
    id: 'user_1',
    sessionId: 'session_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
    requestId,
  };
}
