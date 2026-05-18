import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
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

    await expect(service.submit(currentUser(), dto)).rejects.toBeInstanceOf(ConflictException);
  });
});

function createService(prisma: unknown) {
  const clobClient = {
    getCapability: vi.fn().mockReturnValue({
      status: 'unavailable',
      reason: 'fixture unavailable',
    }),
  } as unknown as ClobClient;
  return new OrdersService(clobClient, prisma as PrismaService);
}

function currentUser(): CurrentUser {
  return {
    id: 'user_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
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
