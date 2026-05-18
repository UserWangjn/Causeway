import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import type { PrismaService } from '../../src/database/prisma.service';
import { ScriptsService } from '../../src/modules/scripts/scripts.service';

describe('ScriptsService', () => {
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
      markets: [
        {
          id: 'script_market_1',
          marketId: 'market_1',
          layer: 0,
          confidence: '1',
          market: {
            question: 'Will market one resolve Yes?',
            outcomes: [
              {
                id: 'outcome_yes',
                label: 'Yes',
                clobTokenId: 'token_yes',
              },
            ],
          },
          selections: [
            {
              id: 'selection_1',
              outcomeId: 'outcome_yes',
              aiAction: 'buy',
              userAction: 'buy',
              orderMode: 'limit',
              limitPrice: '0.42',
              size: null,
              amountUsd: '25',
              reason: 'reason',
              outcome: {
                label: 'Yes',
                clobTokenId: 'token_yes',
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
      include: {
        markets: {
          orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
          include: {
            market: {
              include: {
                outcomes: {
                  orderBy: { outcomeIndex: 'asc' },
                },
              },
            },
            selections: {
              orderBy: { outcomeId: 'asc' },
              include: {
                outcome: true,
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
          },
        ],
        edges: [],
      },
      markets: [
        {
          scriptMarketId: 'script_market_1',
          marketId: 'market_1',
          title: 'Will market one resolve Yes?',
          outcomes: [
            {
              selectionId: 'selection_1',
              outcomeId: 'outcome_yes',
              label: 'Yes',
              tokenId: 'token_yes',
              userAction: 'buy',
              orderMode: 'limit',
              limitPrice: 0.42,
              amountUsd: 25,
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
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
    requestId,
  };
}
