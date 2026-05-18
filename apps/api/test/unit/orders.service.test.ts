import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import { hashJson } from '../../src/common/utils/hash.util';
import type { PrismaService } from '../../src/database/prisma.service';
import type { ClobClient } from '../../src/integrations/polymarket/services/clob.client';
import type { SubmitOrderDto } from '../../src/modules/orders/dto/submit-order.dto';
import { OrdersService } from '../../src/modules/orders/orders.service';

describe('OrdersService', () => {
  it('returns the first idempotent result when a concurrent insert hits the unique constraint', async () => {
    const dto = submitDto();
    const requestHash = hashJson({
      intentId: dto.intentId,
      executionMode: dto.executionMode,
      signedOrders: dto.signedOrders,
    });
    const responseJson = {
      intentId: dto.intentId,
      executionMode: 'dry_run',
      status: 'dry_run_completed',
      orders: [],
    };
    const orderSubmissionFindFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ requestHash, responseJson });
    const orderSubmissionCreate = vi.fn().mockRejectedValue(uniqueConstraintError());
    const causewayOrderUpdateMany = vi.fn();
    const orderIntentUpdate = vi.fn();
    const tx = {
      orderSubmission: {
        create: orderSubmissionCreate,
        update: vi.fn(),
      },
      causewayOrder: {
        updateMany: causewayOrderUpdateMany,
      },
      orderIntent: {
        update: orderIntentUpdate,
      },
    };
    const service = createService({
      orderSubmission: {
        findFirst: orderSubmissionFindFirst,
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: dto.intentId,
          executionMode: 'dry_run',
          status: 'preview_ready',
          previewExpiresAt: new Date(Date.now() + 60_000),
          orders: [],
        }),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    });

    const result = await service.submit(currentUser(), dto);

    expect(result).toEqual(responseJson);
    expect(orderSubmissionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        orderIntentId: dto.intentId,
        idempotencyKey: dto.idempotencyKey,
        requestHash,
        status: 'processing',
      },
    });
    expect(causewayOrderUpdateMany).not.toHaveBeenCalled();
    expect(orderIntentUpdate).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key with a different request hash', async () => {
    const dto = submitDto();
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue({
          requestHash: 'different-request-hash',
          responseJson: { status: 'dry_run_completed' },
        }),
      },
    });

    await expect(service.submit(currentUser(), dto)).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects duplicate selections in an order preview before writing an intent', async () => {
    const transaction = vi.fn();
    const service = createService({
      $transaction: transaction,
    });

    await expect(
      service.preview(currentUser(), {
        scriptId: 'script_1',
        executionMode: 'dry_run',
        selections: [
          {
            selectionId: 'selection_1',
            orderMode: 'limit',
            limitPrice: 0.5,
            amountUsd: 10,
          },
          {
            selectionId: 'selection_1',
            orderMode: 'limit',
            limitPrice: 0.5,
            amountUsd: 10,
          },
        ],
      }),
    ).rejects.toThrow('Duplicate order selections are not allowed');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects previewing a selection that is not marked for buy', async () => {
    const transaction = vi.fn();
    const service = createService({
      causalScript: {
        findFirst: vi.fn().mockResolvedValue({ id: 'script_1' }),
      },
      scriptOutcomeSelection: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'selection_1',
            userAction: 'skip',
          },
        ]),
      },
      $transaction: transaction,
    });

    await expect(
      service.preview(currentUser(), {
        scriptId: 'script_1',
        executionMode: 'dry_run',
        selections: [
          {
            selectionId: 'selection_1',
            orderMode: 'limit',
            limitPrice: 0.5,
            amountUsd: 10,
          },
        ],
      }),
    ).rejects.toThrow('Only buy selections can be previewed for orders');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('writes an audit event when a dry-run submission completes', async () => {
    const dto = submitDto();
    const auditCreate = vi.fn();
    const tx = {
      orderSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission_new' }),
        update: vi.fn(),
      },
      causewayOrder: {
        updateMany: vi.fn(),
      },
      orderIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: auditCreate,
      },
    };
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: dto.intentId,
          executionMode: 'dry_run',
          status: 'preview_ready',
          previewExpiresAt: new Date(Date.now() + 60_000),
          orders: [
            {
              id: 'order_1',
            },
          ],
        }),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    });

    const result = await service.submit(currentUser('req_order_1'), dto);

    expect(result).toMatchObject({
      intentId: dto.intentId,
      status: 'dry_run_completed',
      orders: [
        {
          orderId: 'order_1',
          status: 'dry_run_completed',
        },
      ],
    });
    expect(tx.orderIntent.updateMany).toHaveBeenCalledWith({
      where: {
        id: dto.intentId,
        userId: 'user_1',
        status: {
          in: ['preview_ready', 'user_confirming'],
        },
        OR: [
          {
            previewExpiresAt: null,
          },
          {
            previewExpiresAt: {
              gt: expect.any(Date) as Date,
            },
          },
        ],
      },
      data: { status: 'dry_run_completed' },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        requestId: 'req_order_1',
        actorType: 'user',
        entityType: 'order_intent',
        entityId: dto.intentId,
        action: 'order.submit_dry_run_completed',
        after: {
          intentId: dto.intentId,
          executionMode: 'dry_run',
          status: 'dry_run_completed',
          orders: [
            {
              orderId: 'order_1',
              externalOrderId: null,
              status: 'dry_run_completed',
              errorMessage: null,
            },
          ],
        },
      },
    });
  });

  it('blocks real submit when CLOB capability is unavailable without mutating the intent', async () => {
    const transaction = vi.fn();
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intent_1',
          executionMode: 'real',
          status: 'preview_ready',
          previewExpiresAt: new Date(Date.now() + 60_000),
          orders: [],
        }),
      },
      $transaction: transaction,
    });

    await expect(
      service.submit(currentUser(), {
        ...submitDto(),
        executionMode: 'real',
      }),
    ).rejects.toThrow('fixture unavailable');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects prepare-signature for an intent that contains invalid orders', async () => {
    const orderIntentUpdate = vi.fn();
    const service = createService({
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intent_1',
          executionMode: 'real',
          status: 'preview_ready',
          previewExpiresAt: new Date(Date.now() + 60_000),
          orders: [
            {
              id: 'order_1',
              status: 'failed',
              errorMessage: 'INVALID_TICK_SIZE',
            },
          ],
        }),
        update: orderIntentUpdate,
      },
    }, { status: 'available', reason: null });

    await expect(
      service.prepareSignature(currentUser(), {
        intentId: 'intent_1',
        executionMode: 'real',
        walletAddress: '0x1111111111111111111111111111111111111111',
        chainId: 137,
      }),
    ).rejects.toThrow('Order intent contains invalid orders');
    expect(orderIntentUpdate).not.toHaveBeenCalled();
  });

  it('atomically rejects a second submit that loses the intent status claim', async () => {
    const dto = submitDto();
    const causewayOrderUpdateMany = vi.fn();
    const tx = {
      orderSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission_new' }),
        update: vi.fn(),
      },
      causewayOrder: {
        updateMany: causewayOrderUpdateMany,
      },
      orderIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: dto.intentId,
          executionMode: 'dry_run',
          status: 'preview_ready',
          previewExpiresAt: new Date(Date.now() + 60_000),
          orders: [],
        }),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    });

    await expect(service.submit(currentUser(), dto)).rejects.toThrow(
      'Order intent cannot be submitted from its current status',
    );
    expect(causewayOrderUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects submitting an already completed intent with a new idempotency key', async () => {
    const transaction = vi.fn();
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intent_1',
          executionMode: 'dry_run',
          status: 'dry_run_completed',
          previewExpiresAt: new Date(Date.now() + 60_000),
          orders: [],
        }),
      },
      $transaction: transaction,
    });

    await expect(service.submit(currentUser(), submitDto())).rejects.toThrow(
      'Order intent cannot be submitted from its current status',
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects prepare-signature after the preview expires', async () => {
    const service = createService({
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intent_1',
          executionMode: 'dry_run',
          status: 'preview_ready',
          previewExpiresAt: new Date(Date.now() - 1_000),
          orders: [],
        }),
      },
    });

    await expect(
      service.prepareSignature(currentUser(), {
        intentId: 'intent_1',
        executionMode: 'dry_run',
        walletAddress: '0x1111111111111111111111111111111111111111',
        chainId: 137,
      }),
    ).rejects.toThrow('Order preview has expired');
  });

  it('rejects prepare-signature with a malformed wallet address as a validation error', async () => {
    const orderIntentFindFirst = vi.fn();
    const service = createService({
      orderIntent: {
        findFirst: orderIntentFindFirst,
      },
    });

    await expect(
      service.prepareSignature(currentUser(), {
        intentId: 'intent_1',
        executionMode: 'dry_run',
        walletAddress: 'not-a-wallet',
        chainId: 137,
      }),
    ).rejects.toThrow('Wallet address is invalid');
    expect(orderIntentFindFirst).not.toHaveBeenCalled();
  });
});

function createService(
  prisma: unknown,
  capability: { status: 'available' | 'degraded' | 'unavailable'; reason: string | null } = {
    status: 'unavailable',
    reason: 'fixture unavailable',
  },
) {
  const clobClient = {
    getCapability: vi.fn().mockReturnValue(capability),
  } as unknown as ClobClient;
  return new OrdersService(clobClient, prisma as PrismaService);
}

function currentUser(requestId?: string): CurrentUser {
  return {
    id: 'user_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
    requestId,
  };
}

function submitDto(): SubmitOrderDto {
  return {
    intentId: 'intent_1',
    executionMode: 'dry_run',
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
    signedOrders: [],
  };
}

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}
