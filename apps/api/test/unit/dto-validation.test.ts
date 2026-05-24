import type { ArgumentMetadata } from '@nestjs/common';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { createDtoValidationPipe } from '../../src/common/pipes/dto-validation.pipe';
import { AuthVerifyDto } from '../../src/modules/auth/dto/auth-verify.dto';
import { CreateInferenceRunDto } from '../../src/modules/inference/dto/create-inference-run.dto';
import { InferenceRunParamDto } from '../../src/modules/inference/dto/inference-run-param.dto';
import { EventDetailQueryDto } from '../../src/modules/markets/dto/market-explorer-query.dto';
import { MarketQueryDto } from '../../src/modules/markets/dto/market-query.dto';
import { MarketIdParamDto, MarketOrderBookQueryDto, MarketSlugParamDto } from '../../src/modules/markets/dto/market-route.dto';
import { OrderIntentParamDto } from '../../src/modules/orders/dto/order-intent-param.dto';
import { PrepareSignatureDto } from '../../src/modules/orders/dto/prepare-signature.dto';
import { OrderPreviewDto } from '../../src/modules/orders/dto/order-preview.dto';
import { SubmitOrderDto } from '../../src/modules/orders/dto/submit-order.dto';
import { PortfolioOrdersQueryDto } from '../../src/modules/portfolio/dto/portfolio-orders-query.dto';
import { PortfolioTradesQueryDto } from '../../src/modules/portfolio/dto/portfolio-trades-query.dto';
import { ListScriptsQueryDto } from '../../src/modules/scripts/dto/list-scripts-query.dto';
import { ScriptIdParamDto, ScriptSelectionParamDto } from '../../src/modules/scripts/dto/script-route.dto';
import { UpdateOutcomeSelectionDto } from '../../src/modules/scripts/dto/update-outcome-selection.dto';

describe('DTO validation boundaries', () => {
  it('accepts representative valid public API payloads', async () => {
    await expectValid(MarketQueryDto, {
      q: 'Election',
      category: 'politics',
      active: 'true',
      closed: 'false',
      sort: 'volume',
      cursor: 'cursor-token',
      limit: 100,
    });
    await expectValid(EventDetailQueryDto, {
      marketId: 'market_1',
      refresh: 'true',
    });
    await expectValid(OrderPreviewDto, {
      scriptId: 'script_1',
      executionMode: 'dry_run',
      selections: [
        {
          selectionId: 'selection_1',
          orderMode: 'limit',
          amountUsd: 10,
          limitPrice: 0.55,
          orderType: 'GTC',
        },
      ],
    });
    await expectValid(SubmitOrderDto, {
      intentId: 'intent_1',
      executionMode: 'dry_run',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      signedOrders: [],
    });
    await expectValid(ListScriptsQueryDto, {
      limit: 20,
      cursor: 'cursor-token',
      status: 'draft',
      q: 'market keyword',
    });
  });

  it('rejects oversized freeform request fields before they reach services', async () => {
    await expectInvalid(MarketQueryDto, {
      q: 'x'.repeat(201),
      category: 'x'.repeat(65),
      cursor: 'x'.repeat(2049),
    });
    await expectInvalid(EventDetailQueryDto, {
      marketId: 'market_1',
      refresh: 'yes',
    });
    await expectInvalid(AuthVerifyDto, {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 137,
      message: 'x'.repeat(2049),
      signature: 'x'.repeat(257),
    });
    await expectInvalid(CreateInferenceRunDto, {
      rootMarketId: 'x'.repeat(129),
      rootOutcomeId: 'outcome_1',
      depth: 1,
      maxMarketsPerLayer: 2,
      confidenceThreshold: 0.5,
      model: 'gpt-5.4',
    });
    await expectInvalid(UpdateOutcomeSelectionDto, {
      reason: 'x'.repeat(501),
    });
    await expectInvalid(PortfolioOrdersQueryDto, {
      cursor: 'x'.repeat(2049),
    });
    await expectInvalid(PortfolioTradesQueryDto, {
      cursor: 'x'.repeat(2049),
    });
    await expectInvalid(ListScriptsQueryDto, {
      limit: 51,
      cursor: 'x'.repeat(2049),
      status: 'submitted',
      q: 'x'.repeat(201),
    });
  });

  it('rejects oversized order arrays', async () => {
    await expectInvalid(OrderPreviewDto, {
      scriptId: 'script_1',
      executionMode: 'dry_run',
      selections: Array.from({ length: 51 }, (_value, index) => ({
        selectionId: `selection_${index}`,
        orderMode: 'limit',
        amountUsd: 10,
        limitPrice: 0.55,
        orderType: 'GTC',
      })),
    });
    await expectInvalid(SubmitOrderDto, {
      intentId: 'intent_1',
      executionMode: 'dry_run',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      signedOrders: Array.from({ length: 51 }, (_value, index) => ({ index })),
    });
  });

  it('preserves signed order objects through Nest request validation', async () => {
    const signature = `0x${'a'.repeat(130)}`;
    const result = await transformDto(SubmitOrderDto, {
      intentId: 'intent_1',
      executionMode: 'real',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      signedOrders: [{ orderId: 'order_1', signature }],
    });

    expect(result.signedOrders).toEqual([{ orderId: 'order_1', signature }]);
    expect(Array.isArray(result.signedOrders[0])).toBe(false);
  });

  it('rejects oversized route params and token query values', async () => {
    await expectInvalid(InferenceRunParamDto, {
      runId: 'x'.repeat(129),
    });
    await expectInvalid(MarketIdParamDto, {
      marketId: 'x'.repeat(129),
    });
    await expectInvalid(MarketSlugParamDto, {
      slug: 'x'.repeat(257),
    });
    await expectInvalid(MarketOrderBookQueryDto, {
      tokenId: 'x'.repeat(257),
    });
    await expectInvalid(OrderIntentParamDto, {
      intentId: 'x'.repeat(129),
    });
    await expectInvalid(ScriptIdParamDto, {
      scriptId: 'x'.repeat(129),
    });
    await expectInvalid(ScriptSelectionParamDto, {
      scriptId: 'script_1',
      selectionId: 'x'.repeat(129),
    });
  });

  it('rejects blank identifier values before they reach services', async () => {
    await expectInvalid(InferenceRunParamDto, {
      runId: '   ',
    });
    await expectInvalid(MarketIdParamDto, {
      marketId: '   ',
    });
    await expectInvalid(MarketSlugParamDto, {
      slug: '   ',
    });
    await expectInvalid(MarketOrderBookQueryDto, {
      tokenId: '   ',
    });
    await expectInvalid(OrderIntentParamDto, {
      intentId: '   ',
    });
    await expectInvalid(ScriptIdParamDto, {
      scriptId: '   ',
    });
    await expectInvalid(ScriptSelectionParamDto, {
      scriptId: 'script_1',
      selectionId: '   ',
    });
    await expectInvalid(CreateInferenceRunDto, {
      rootMarketId: '   ',
      rootOutcomeId: 'outcome_1',
      depth: 1,
      maxMarketsPerLayer: 2,
      confidenceThreshold: 0.5,
      model: 'gpt-5.4',
    });
    await expectInvalid(OrderPreviewDto, {
      scriptId: 'script_1',
      executionMode: 'dry_run',
      selections: [
        {
          selectionId: '   ',
          orderMode: 'limit',
          amountUsd: 10,
          limitPrice: 0.55,
          orderType: 'GTC',
        },
      ],
    });
    await expectInvalid(PrepareSignatureDto, {
      intentId: '   ',
      executionMode: 'dry_run',
      walletAddress: '0x1111111111111111111111111111111111111111',
      chainId: 137,
    });
    await expectInvalid(SubmitOrderDto, {
      intentId: '   ',
      executionMode: 'dry_run',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      signedOrders: [],
    });
  });

  it('trims identifier values before validation and service handoff', async () => {
    await expectTrimmedValue(MarketIdParamDto, { marketId: ' market_1 ' }, 'marketId', 'market_1');
    await expectTrimmedValue(MarketSlugParamDto, { slug: ' fixture-binary-market ' }, 'slug', 'fixture-binary-market');
    await expectTrimmedValue(MarketOrderBookQueryDto, { tokenId: ' token_1 ' }, 'tokenId', 'token_1');
    await expectTrimmedValue(OrderIntentParamDto, { intentId: ' intent_1 ' }, 'intentId', 'intent_1');
    await expectTrimmedValue(ScriptSelectionParamDto, { scriptId: ' script_1 ', selectionId: ' selection_1 ' }, 'scriptId', 'script_1');
    await expectTrimmedValue(ScriptSelectionParamDto, { scriptId: ' script_1 ', selectionId: ' selection_1 ' }, 'selectionId', 'selection_1');
  });
});

type DtoConstructor<T extends object> = new () => T;

async function expectValid<T extends object>(dto: DtoConstructor<T>, payload: Record<string, unknown>): Promise<void> {
  const errors = await validateDto(dto, payload);
  expect(errors).toHaveLength(0);
}

async function expectInvalid<T extends object>(dto: DtoConstructor<T>, payload: Record<string, unknown>): Promise<void> {
  const errors = await validateDto(dto, payload);
  expect(errors.length).toBeGreaterThan(0);
}

async function validateDto<T extends object>(dto: DtoConstructor<T>, payload: Record<string, unknown>) {
  const instance = plainToInstance(dto, payload);
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

async function transformDto<T extends object>(dto: DtoConstructor<T>, payload: Record<string, unknown>): Promise<T> {
  const pipe = createDtoValidationPipe(dto);
  const metadata: ArgumentMetadata = { type: 'body', metatype: dto };
  return pipe.transform(payload, metadata) as Promise<T>;
}

async function expectTrimmedValue<T extends object>(
  dto: DtoConstructor<T>,
  payload: Record<string, unknown>,
  property: keyof T,
  expectedValue: string,
): Promise<void> {
  const instance = plainToInstance(dto, payload);
  expect(instance[property]).toBe(expectedValue);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  expect(errors).toHaveLength(0);
}
