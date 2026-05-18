import { HttpStatus, Injectable } from '@nestjs/common';
import { OrderMode, UserSelectionAction } from '@prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { UpdateOutcomeSelectionDto } from './dto/update-outcome-selection.dto';

@Injectable()
export class ScriptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getScript(user: CurrentUser, scriptId: string) {
    const script = await this.prisma.causalScript.findFirst({
      where: { id: scriptId, userId: user.id },
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
              include: {
                outcome: true,
              },
            },
          },
        },
      },
    });
    if (!script) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_FAILED', 'Causal script was not found');
    }

    return {
      id: script.id,
      title: script.title,
      status: script.status,
      rootMarketId: script.rootMarketId,
      rootOutcomeId: script.rootOutcomeId,
      graph: script.graphJson,
      summary: script.summary,
      createdAt: script.createdAt.toISOString(),
      updatedAt: script.updatedAt.toISOString(),
      markets: script.markets.map((scriptMarket) => ({
        id: scriptMarket.id,
        marketId: scriptMarket.marketId,
        layer: scriptMarket.layer,
        impactDirection: scriptMarket.impactDirection,
        confidence: toNullableNumber(scriptMarket.confidence),
        reason: scriptMarket.reason,
        metadata: scriptMarket.metadata,
        market: {
          id: scriptMarket.market.id,
          slug: scriptMarket.market.slug,
          question: scriptMarket.market.question,
          icon: scriptMarket.market.icon,
          image: scriptMarket.market.image,
          active: scriptMarket.market.active,
          closed: scriptMarket.market.closed,
          acceptingOrders: scriptMarket.market.acceptingOrders,
          enableOrderBook: scriptMarket.market.enableOrderBook,
          outcomes: scriptMarket.market.outcomes.map((outcome) => ({
            id: outcome.id,
            label: outcome.label,
            clobTokenId: outcome.clobTokenId,
            price: toNullableNumber(outcome.price),
          })),
        },
        selections: scriptMarket.selections.map((selection) => ({
          id: selection.id,
          outcomeId: selection.outcomeId,
          outcomeLabel: selection.outcome.label,
          aiAction: selection.aiAction,
          userAction: selection.userAction,
          side: selection.side,
          orderMode: selection.orderMode,
          limitPrice: toNullableNumber(selection.limitPrice),
          size: toNullableNumber(selection.size),
          amountUsd: toNullableNumber(selection.amountUsd),
          confidence: toNullableNumber(selection.confidence),
          reason: selection.reason,
          updatedAt: selection.updatedAt.toISOString(),
        })),
      })),
    };
  }

  async updateOutcomeSelection(user: CurrentUser, scriptId: string, selectionId: string, dto: UpdateOutcomeSelectionDto) {
    const selection = await this.prisma.scriptOutcomeSelection.findFirst({
      where: {
        id: selectionId,
        scriptMarket: {
          scriptId,
          script: {
            userId: user.id,
          },
        },
      },
    });
    if (!selection) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'OUTCOME_NOT_FOUND', 'Script outcome selection was not found');
    }

    const updated = await this.prisma.scriptOutcomeSelection.update({
      where: { id: selectionId },
      data: {
        userAction: dto.userAction as UserSelectionAction | undefined,
        orderMode: dto.orderMode as OrderMode | undefined,
        limitPrice: dto.orderMode === 'market' ? null : dto.limitPrice,
        size: dto.size,
        amountUsd: dto.amountUsd,
        reason: dto.reason,
      },
    });

    return {
      id: updated.id,
      userAction: updated.userAction,
      orderMode: updated.orderMode,
      limitPrice: toNullableNumber(updated.limitPrice),
      size: toNullableNumber(updated.size),
      amountUsd: toNullableNumber(updated.amountUsd),
      reason: updated.reason,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
