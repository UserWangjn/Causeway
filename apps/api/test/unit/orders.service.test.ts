import { Prisma } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import { hashJson } from '../../src/common/utils/hash.util';
import type { PrismaService } from '../../src/database/prisma.service';
import type { ClobClient, PreparedClobOrder } from '../../src/integrations/polymarket/services/clob.client';
import type { SubmitOrderDto } from '../../src/modules/orders/dto/submit-order.dto';
import { OrdersService } from '../../src/modules/orders/orders.service';
import type { TradingService } from '../../src/modules/trading/trading.service';

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

  it('returns the first real-submit idempotent result when a concurrent insert wins the reservation', async () => {
    const dto: SubmitOrderDto = {
      ...submitDto(),
      executionMode: 'real',
      signedOrders: [
        {
          orderId: 'order_1',
          signature: `0x${'a'.repeat(130)}`,
        },
      ],
    };
    const requestHash = hashJson({
      intentId: dto.intentId,
      executionMode: dto.executionMode,
      signedOrders: dto.signedOrders,
    });
    const responseJson = {
      intentId: dto.intentId,
      executionMode: 'real',
      status: 'submitted',
      orders: [],
    };
    const orderSubmissionFindFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ requestHash, responseJson });
    const postSignedOrders = vi.fn();
    const tx = {
      orderSubmission: {
        create: vi.fn().mockRejectedValue(uniqueConstraintError()),
      },
      orderIntent: {
        updateMany: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const service = createService({
      orderSubmission: {
        findFirst: orderSubmissionFindFirst,
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue(realIntent(dto.intentId, preparedClobOrder('order_1'))),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, { status: 'available', reason: null }, { postSignedOrders });

    const result = await service.submit(currentUser(), dto);

    expect(result).toEqual(responseJson);
    expect(tx.orderIntent.updateMany).not.toHaveBeenCalled();
    expect(postSignedOrders).not.toHaveBeenCalled();
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

  it('keeps a real preview unsigned when the requested amount exceeds available funding', async () => {
    const createdIntent = {
      id: 'intent_1',
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
    };
    const tx = {
      orderIntent: {
        create: vi.fn().mockResolvedValue(createdIntent),
      },
      causewayOrder: {
        create: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const orderIntentUpdate = vi.fn();
    const service = createService({
      causalScript: {
        findFirst: vi.fn().mockResolvedValue({ id: 'script_1' }),
      },
      scriptOutcomeSelection: {
        findMany: vi.fn().mockResolvedValue([previewSelectionRow()]),
      },
      orderIntent: {
        update: orderIntentUpdate,
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, {
      status: 'available',
      reason: null,
      cashAvailable: 5,
      collateralAvailable: 100,
      balanceCapability: 'available',
      balanceCapabilityReason: null,
    }, {
      getOrderBook: vi.fn().mockResolvedValue({
        tokenId: '123456789012345678901',
        bids: [],
        asks: [{ price: 0.5, size: 100 }],
        tickSize: 0.01,
        minOrderSize: 1,
        refreshedAt: '2026-05-20T00:00:00.000Z',
      }),
    });

    const result = await service.preview(currentUser(), {
      scriptId: 'script_1',
      executionMode: 'real',
      selections: [
        {
          selectionId: 'selection_1',
          orderMode: 'market',
          amountUsd: 10,
        },
      ],
    });

    expect(result).toMatchObject({
      intentId: 'intent_1',
      executionMode: 'real',
      tradingCapability: 'unavailable',
      balanceCapability: 'unavailable',
      cashAvailable: 5,
      totalAmountUsd: 10,
      requiresSignature: false,
      submitMode: 'unavailable',
      tradingCapabilityReason: 'Insufficient Polymarket Safe wallet balance: $10.00 required, $5.00 available.',
    });
    expect(tx.orderIntent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tradingCapability: 'unavailable',
        tradingCapabilityReason: 'Insufficient Polymarket Safe wallet balance: $10.00 required, $5.00 available.',
        balanceCapability: 'unavailable',
        balanceCapabilityReason: 'Insufficient Polymarket Safe wallet balance: $10.00 required, $5.00 available.',
        cashAvailable: 5,
        totalAmountUsd: 10,
      }) as unknown,
    });
    expect(orderIntentUpdate).toHaveBeenCalledWith({
      where: { id: 'intent_1' },
      data: {
        previewJson: expect.objectContaining({
          requiresSignature: false,
          submitMode: 'unavailable',
        }) as unknown,
      },
    });
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

  it('prepares real CLOB signature payloads and persists them for submit', async () => {
    const preparedOrder = preparedClobOrder('order_1');
    const prepareSignaturePayloads = vi.fn().mockReturnValue([preparedOrder]);
    const tx = {
      orderIntent: {
        update: vi.fn(),
      },
      causewayOrder: {
        update: vi.fn(),
      },
    };
    const service = createService({
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue(realIntent('intent_1')),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, { status: 'available', reason: null }, { prepareSignaturePayloads });

    const result = await service.prepareSignature(currentUser(), {
      intentId: 'intent_1',
      executionMode: 'real',
      walletAddress: '0x1111111111111111111111111111111111111111',
      chainId: 137,
    });

    expect(result).toMatchObject({
      intentId: 'intent_1',
      executionMode: 'real',
      signingStatus: 'ready',
      protocol: 'polymarket_clob_eip712_v2',
      payloads: [preparedOrder],
    });
    expect(prepareSignaturePayloads).toHaveBeenCalledWith([
      expect.objectContaining({
        orderId: 'order_1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        funderAddress: '0x2222222222222222222222222222222222222222',
        chainId: 137,
        tokenId: 'token_1',
        tickSize: 0.01,
        negRisk: false,
      }),
    ], expect.any(Date), expect.objectContaining({
      credentials: testClobCredentials(),
      signatureType: 2,
    }));
    expect(tx.causewayOrder.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: {
        submitPayload: {
          tickSize: 0.01,
          preparedClobOrder: preparedOrder,
        },
      },
    });
  });

  it('submits real signed CLOB orders and stores external order ids', async () => {
    const dto = {
      ...submitDto(),
      executionMode: 'real',
      signedOrders: [
        {
          orderId: 'order_1',
          signature: `0x${'a'.repeat(130)}`,
        },
      ],
    };
    const postSignedOrders = vi.fn().mockResolvedValue([
      {
        orderId: 'order_1',
        externalOrderId: 'clob_order_1',
        status: 'submitted',
        errorMessage: null,
        response: { success: true, orderID: 'clob_order_1' },
      },
    ]);
    const claimTx = {
      orderSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission_1' }),
      },
      orderIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const completeTx = {
      orderIntent: {
        update: vi.fn(),
      },
      causalScript: {
        updateMany: vi.fn(),
      },
      causewayOrder: {
        update: vi.fn(),
      },
      orderSubmission: {
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const transaction = vi
      .fn()
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(claimTx))
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(completeTx));
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue(realIntent('intent_1', preparedClobOrder('order_1'))),
      },
      $transaction: transaction,
    }, { status: 'available', reason: null }, { postSignedOrders });

    const result = await service.submit(currentUser('req_real_1'), dto);

    expect(result).toMatchObject({
      intentId: 'intent_1',
      executionMode: 'real',
      status: 'submitted',
      orders: [
        {
          orderId: 'order_1',
          externalOrderId: 'clob_order_1',
          status: 'submitted',
          errorMessage: null,
        },
      ],
    });
    expect(postSignedOrders).toHaveBeenCalledWith([
      {
        preparedOrder: preparedClobOrder('order_1'),
        signature: `0x${'a'.repeat(130)}`,
      },
    ], testClobCredentials());
    expect(completeTx.causewayOrder.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: {
        externalOrderId: 'clob_order_1',
        status: 'submitted',
        errorMessage: null,
        responsePayload: { success: true, orderID: 'clob_order_1' },
      },
    });
    expect(completeTx.causalScript.updateMany).toHaveBeenCalledWith({
      where: { id: 'script_1', userId: 'user_1' },
      data: { status: 'active' },
    });
  });

  it('accepts legacy single-order signedOrders signature strings by intent order position', async () => {
    const dto = {
      ...submitDto(),
      executionMode: 'real',
      signedOrders: [`0x${'b'.repeat(130)}`],
    };
    const postSignedOrders = vi.fn().mockResolvedValue([
      {
        orderId: 'order_1',
        externalOrderId: 'clob_order_1',
        status: 'submitted',
        errorMessage: null,
        response: { success: true, orderID: 'clob_order_1' },
      },
    ]);
    const claimTx = {
      orderSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission_1' }),
      },
      orderIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const completeTx = {
      orderIntent: {
        update: vi.fn(),
      },
      causalScript: {
        updateMany: vi.fn(),
      },
      causewayOrder: {
        update: vi.fn(),
      },
      orderSubmission: {
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const transaction = vi
      .fn()
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(claimTx))
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(completeTx));
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue(realIntent('intent_1', preparedClobOrder('order_1'))),
      },
      $transaction: transaction,
    }, { status: 'available', reason: null }, { postSignedOrders });

    await service.submit(currentUser('req_real_legacy'), dto);

    expect(postSignedOrders).toHaveBeenCalledWith([
      {
        preparedOrder: preparedClobOrder('order_1'),
        signature: `0x${'b'.repeat(130)}`,
      },
    ], testClobCredentials());
  });

  it('accepts tuple signedOrders from older clients', async () => {
    const dto = {
      ...submitDto(),
      executionMode: 'real',
      signedOrders: [['order_1', `0x${'c'.repeat(130)}`]],
    };
    const postSignedOrders = vi.fn().mockResolvedValue([
      {
        orderId: 'order_1',
        externalOrderId: 'clob_order_1',
        status: 'submitted',
        errorMessage: null,
        response: { success: true, orderID: 'clob_order_1' },
      },
    ]);
    const claimTx = {
      orderSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission_1' }),
      },
      orderIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const completeTx = {
      orderIntent: {
        update: vi.fn(),
      },
      causalScript: {
        updateMany: vi.fn(),
      },
      causewayOrder: {
        update: vi.fn(),
      },
      orderSubmission: {
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const transaction = vi
      .fn()
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(claimTx))
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(completeTx));
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue(realIntent('intent_1', preparedClobOrder('order_1'))),
      },
      $transaction: transaction,
    }, { status: 'available', reason: null }, { postSignedOrders });

    await service.submit(currentUser('req_real_tuple'), dto);

    expect(postSignedOrders).toHaveBeenCalledWith([
      {
        preparedOrder: preparedClobOrder('order_1'),
        signature: `0x${'c'.repeat(130)}`,
      },
    ], testClobCredentials());
  });

  it('accepts byte-array signatures from wallet adapters', async () => {
    const byteSignature = Array.from({ length: 65 }, () => 0xab);
    const expectedSignature = `0x${'ab'.repeat(65)}`;
    const dto = {
      ...submitDto(),
      executionMode: 'real',
      signedOrders: [byteSignature],
    };
    const postSignedOrders = vi.fn().mockResolvedValue([
      {
        orderId: 'order_1',
        externalOrderId: 'clob_order_1',
        status: 'submitted',
        errorMessage: null,
        response: { success: true, orderID: 'clob_order_1' },
      },
    ]);
    const claimTx = {
      orderSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission_1' }),
      },
      orderIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const completeTx = {
      orderIntent: {
        update: vi.fn(),
      },
      causalScript: {
        updateMany: vi.fn(),
      },
      causewayOrder: {
        update: vi.fn(),
      },
      orderSubmission: {
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const transaction = vi
      .fn()
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(claimTx))
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(completeTx));
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue(realIntent('intent_1', preparedClobOrder('order_1'))),
      },
      $transaction: transaction,
    }, { status: 'available', reason: null }, { postSignedOrders });

    await service.submit(currentUser('req_real_byte_array'), dto);

    expect(postSignedOrders).toHaveBeenCalledWith([
      {
        preparedOrder: preparedClobOrder('order_1'),
        signature: expectedSignature,
      },
    ], testClobCredentials());
  });

  it('marks real submit as unknown when the CLOB submit result may have been accepted', async () => {
    const dto = {
      ...submitDto(),
      executionMode: 'real',
      signedOrders: [
        {
          orderId: 'order_1',
          signature: `0x${'a'.repeat(130)}`,
        },
      ],
    };
    const postSignedOrders = vi.fn().mockRejectedValue(new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB request failed after retries', {
      endpoint: '/orders',
      cause: 'CLOB request timed out',
    }));
    const claimTx = {
      orderSubmission: {
        create: vi.fn().mockResolvedValue({ id: 'submission_1' }),
      },
      orderIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const unknownTx = {
      orderIntent: {
        update: vi.fn(),
      },
      causewayOrder: {
        updateMany: vi.fn(),
      },
      orderSubmission: {
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const transaction = vi
      .fn()
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(claimTx))
      .mockImplementationOnce((callback: (transactionClient: unknown) => Promise<unknown>) => callback(unknownTx));
    const service = createService({
      orderSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      orderIntent: {
        findFirst: vi.fn().mockResolvedValue(realIntent('intent_1', preparedClobOrder('order_1'))),
      },
      $transaction: transaction,
    }, { status: 'available', reason: null }, { postSignedOrders });

    const result = await service.submit(currentUser('req_real_unknown'), dto);

    expect(result).toMatchObject({
      intentId: 'intent_1',
      executionMode: 'real',
      status: 'unknown',
      orders: [
        {
          orderId: 'order_1',
          status: 'unknown',
          errorMessage: 'CLOB request failed after retries',
        },
      ],
    });
    expect(unknownTx.orderIntent.update).toHaveBeenCalledWith({
      where: { id: 'intent_1' },
      data: { status: 'unknown' },
    });
    expect(unknownTx.causewayOrder.updateMany).toHaveBeenCalledWith({
      where: { orderIntentId: 'intent_1', status: { in: ['preview_ready', 'submitted'] } },
      data: { status: 'unknown', errorMessage: 'CLOB request failed after retries' },
    });
    expect(unknownTx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'order.submit_real_unknown',
      }) as unknown,
    });
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
  capability: TestCapability = {
    status: 'unavailable',
    reason: 'fixture unavailable',
  },
  clobOverrides: Partial<ClobClient> = {},
) {
  const defaultFunding = capability.status === 'available' ? 1_000 : null;
  const clobClient = {
    getCapability: vi.fn().mockReturnValue(capability),
    resolveFunderAddress: vi.fn().mockResolvedValue('0x2222222222222222222222222222222222222222'),
    getOrderBook: vi.fn().mockResolvedValue(null),
    prepareSignaturePayloads: vi.fn().mockReturnValue([]),
    postSignedOrders: vi.fn(),
    ...clobOverrides,
  } as unknown as ClobClient;
  const tradingService = {
    getOrderCapability: vi.fn().mockResolvedValue({
      ...capability,
      signatureType: 2,
      requestedTradingAccountType: 'auto',
      tradingAccountType: 'gnosis_safe',
      tradingAccountLabel: 'Polymarket Safe wallet',
      funderAddress: '0x2222222222222222222222222222222222222222',
      clobApiKeyPreview: 'test...key',
      cashAvailable: capability.cashAvailable ?? defaultFunding,
      collateralAvailable: capability.collateralAvailable ?? defaultFunding,
      balanceCapability: capability.balanceCapability ?? (capability.status === 'available' ? 'available' : 'degraded'),
      balanceCapabilityReason: capability.balanceCapabilityReason ?? null,
      accountOptions: [],
    }),
    getOrderAuth: vi.fn().mockResolvedValue({
      credentials: testClobCredentials(),
      signatureType: 2,
      funderAddress: '0x2222222222222222222222222222222222222222',
      tradingAccountType: 'gnosis_safe',
    }),
  };
  return new OrdersService(clobClient, prisma as PrismaService, tradingService as unknown as TradingService);
}

type TestCapability = {
  status: 'available' | 'degraded' | 'unavailable';
  reason: string | null;
  cashAvailable?: number | null;
  collateralAvailable?: number | null;
  balanceCapability?: 'available' | 'degraded' | 'unavailable';
  balanceCapabilityReason?: string | null;
};

function testClobCredentials() {
  return {
    key: 'api-key',
    secret: 'api-secret',
    passphrase: 'api-passphrase',
    address: '0x1111111111111111111111111111111111111111',
  };
}

function currentUser(requestId?: string): CurrentUser {
  return {
    id: 'user_1',
    sessionId: 'session_1',
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

function realIntent(intentId: string, preparedOrder?: PreparedClobOrder) {
  return {
    id: intentId,
    scriptId: 'script_1',
    executionMode: 'real',
    status: 'preview_ready',
    totalAmountUsd: 5,
    previewExpiresAt: new Date(Date.now() + 60_000),
    orders: [
      {
        id: 'order_1',
        externalOrderId: null,
        submitPayload: preparedOrder ? { tickSize: 0.01, preparedClobOrder: preparedOrder } : { tickSize: 0.01 },
        clobTokenId: 'token_1',
        side: 'BUY',
        orderMode: 'limit',
        orderType: 'GTC',
        limitPrice: 0.5,
        estimatedFillPrice: 0.5,
        size: 10,
        amountUsd: 5,
        market: {
          negRisk: false,
          orderPriceMinTickSize: 0.01,
        },
      },
    ],
  };
}

function previewSelectionRow() {
  return {
    id: 'selection_1',
    userAction: 'buy',
    outcome: {
      id: 'outcome_1',
      label: 'Yes',
      clobTokenId: '123456789012345678901',
      price: 0.5,
      bestAsk: 0.5,
      lastTradePrice: 0.5,
    },
    scriptMarket: {
      market: {
        id: 'market_1',
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        acceptingOrders: true,
        enableOrderBook: true,
        bestAsk: 0.5,
        lastTradePrice: 0.5,
        orderMinSize: 1,
        orderPriceMinTickSize: 0.01,
      },
    },
  };
}

function preparedClobOrder(orderId: string): PreparedClobOrder {
  return {
    orderId,
    protocol: 'polymarket_clob_eip712_v2',
    orderType: 'GTC',
    postOnly: false,
    deferExec: false,
    tickSize: '0.01',
    negRisk: false,
    signatureType: 2,
    makerAddress: '0x2222222222222222222222222222222222222222',
    signerAddress: '0x1111111111111111111111111111111111111111',
    funderAddress: '0x2222222222222222222222222222222222222222',
    expiresAt: '2026-05-19T00:00:00.000Z',
    eip712: {
      primaryType: 'Order',
      domain: {
        name: 'Polymarket CTF Exchange',
        version: '2',
        chainId: 137,
        verifyingContract: '0xE111180000d2663C0091e4f400237545B87B996B',
      },
      types: {
        Order: [
          { name: 'salt', type: 'uint256' },
          { name: 'maker', type: 'address' },
          { name: 'signer', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'makerAmount', type: 'uint256' },
          { name: 'takerAmount', type: 'uint256' },
          { name: 'side', type: 'uint8' },
          { name: 'signatureType', type: 'uint8' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'metadata', type: 'bytes32' },
          { name: 'builder', type: 'bytes32' },
        ],
      },
      message: {
        salt: '1',
        maker: '0x2222222222222222222222222222222222222222',
        signer: '0x1111111111111111111111111111111111111111',
        tokenId: 'token_1',
        makerAmount: '5000000',
        takerAmount: '10000000',
        side: 0,
        signatureType: 2,
        timestamp: '1',
        metadata: `0x${'0'.repeat(64)}`,
        builder: `0x${'0'.repeat(64)}`,
      },
    },
    order: {
      salt: '1',
      maker: '0x2222222222222222222222222222222222222222',
      signer: '0x1111111111111111111111111111111111111111',
      tokenId: 'token_1',
      makerAmount: '5000000',
      takerAmount: '10000000',
      side: 'BUY',
      signatureType: 2,
      timestamp: '1',
      expiration: '0',
      metadata: `0x${'0'.repeat(64)}`,
      builder: `0x${'0'.repeat(64)}`,
    },
  };
}
