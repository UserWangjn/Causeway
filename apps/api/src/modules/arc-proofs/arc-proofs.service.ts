import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createPublicClient, defineChain, getAddress, http } from 'viem';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { hashJson } from '../../common/utils/hash.util';
import { PrismaService } from '../../database/prisma.service';
import { publicModelForInferenceRun } from '../inference/inference-models';
import { CompleteArcProofDto } from './dto/complete-arc-proof.dto';

const ARC_TESTNET_CHAIN_ID = 5_042_002;
const ARC_EXPLORER_BASE_URL = 'https://testnet.arcscan.app';
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const ARC_PROOF_ACTION = 'arc_proof.script_anchored';

const arcTestnetChain = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
  },
});

const arcPublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: http(ARC_RPC_URL),
});

const ARC_SCRIPT_SELECT = Prisma.validator<Prisma.CausalScriptSelect>()({
  id: true,
  title: true,
  status: true,
  rootMarketId: true,
  rootOutcomeId: true,
  summary: true,
  createdAt: true,
  updatedAt: true,
  graphJson: true,
  inferenceRun: {
    select: {
      id: true,
      model: true,
      promptVersion: true,
      outputSchemaVersion: true,
      inputJson: true,
      outputJson: true,
      createdAt: true,
      completedAt: true,
    },
  },
  markets: {
    orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      layer: true,
      impactDirection: true,
      confidence: true,
      reason: true,
      market: {
        select: {
          id: true,
          question: true,
          conditionId: true,
          slug: true,
          bestBid: true,
          bestAsk: true,
          lastTradePrice: true,
          volume: true,
          volume24hr: true,
          liquidity: true,
          endDate: true,
          syncedAt: true,
          event: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
      },
      selections: {
        orderBy: { outcomeId: 'asc' },
        select: {
          id: true,
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
});

type ArcScriptRecord = Prisma.CausalScriptGetPayload<{ select: typeof ARC_SCRIPT_SELECT }>;

@Injectable()
export class ArcProofsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getScriptProof(user: CurrentUser, scriptId: string) {
    const script = await this.loadUserScript(user, scriptId);
    const proof = buildScriptProof(script);
    const anchor = await this.getLatestAnchor(user, scriptId);
    return {
      ...proof,
      anchor,
    };
  }

  async completeScriptProof(user: CurrentUser, scriptId: string, dto: CompleteArcProofDto) {
    const script = await this.loadUserScript(user, scriptId);
    const proof = buildScriptProof(script);
    const fromAddress = getAddress(dto.fromAddress);
    if (fromAddress.toLowerCase() !== user.walletAddress.toLowerCase()) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Arc proof signer must match the connected wallet');
    }
    if (dto.chainId !== ARC_TESTNET_CHAIN_ID) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Arc proof must be anchored on Arc Testnet', {
        expectedChainId: ARC_TESTNET_CHAIN_ID,
        receivedChainId: dto.chainId,
      });
    }
    if (dto.traceHash.toLowerCase() !== proof.traceHash.toLowerCase()) {
      throw new ApiException(HttpStatus.CONFLICT, 'REQUEST_FAILED', 'Reasoning trace hash changed; refresh the proof before anchoring');
    }
    if (dto.calldata && dto.calldata.toLowerCase() !== proof.calldata.toLowerCase()) {
      throw new ApiException(HttpStatus.CONFLICT, 'REQUEST_FAILED', 'Arc proof calldata does not match the current reasoning trace');
    }
    await verifyArcTransaction(dto.txHash, fromAddress, proof.calldata);

    const anchoredAt = new Date().toISOString();
    const anchor = {
      chainId: ARC_TESTNET_CHAIN_ID,
      fromAddress,
      txHash: dto.txHash,
      traceHash: proof.traceHash,
      calldata: proof.calldata,
      arcscanUrl: `${ARC_EXPLORER_BASE_URL}/tx/${dto.txHash}`,
      anchoredAt,
    };
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        requestId: user.requestId,
        actorType: 'user',
        entityType: 'causal_script',
        entityId: scriptId,
        action: ARC_PROOF_ACTION,
        after: toJson(anchor),
        reason: 'Reasoning trace anchored to Arc Testnet',
      },
    });

    return {
      ...proof,
      anchor,
    };
  }

  private async loadUserScript(user: CurrentUser, scriptId: string): Promise<ArcScriptRecord> {
    const script = await this.prisma.causalScript.findFirst({
      where: { id: scriptId, userId: user.id },
      select: ARC_SCRIPT_SELECT,
    });
    if (!script) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_FAILED', 'Causal script was not found');
    }
    return script;
  }

  private async getLatestAnchor(user: CurrentUser, scriptId: string) {
    const event = await this.prisma.auditEvent.findFirst({
      where: {
        userId: user.id,
        entityType: 'causal_script',
        entityId: scriptId,
        action: ARC_PROOF_ACTION,
      },
      orderBy: { createdAt: 'desc' },
      select: { after: true, createdAt: true },
    });
    if (!event?.after || typeof event.after !== 'object') return null;
    return event.after;
  }
}

function buildScriptProof(script: ArcScriptRecord) {
  const capsule = {
    schema: 'causeway.reasoning_trace.v1',
    scriptId: script.id,
    inferenceRunId: script.inferenceRun.id,
    title: script.title,
    status: script.status,
    summary: script.summary,
    rootMarketId: script.rootMarketId,
    rootOutcomeId: script.rootOutcomeId,
    graph: script.graphJson,
    inference: {
      model: publicModelForInferenceRun(script.inferenceRun.model, script.inferenceRun.inputJson) ?? script.inferenceRun.model,
      promptVersion: script.inferenceRun.promptVersion,
      outputSchemaVersion: script.inferenceRun.outputSchemaVersion,
      inputHash: `0x${hashJson(script.inferenceRun.inputJson)}`,
      outputHash: script.inferenceRun.outputJson == null ? null : `0x${hashJson(script.inferenceRun.outputJson)}`,
      createdAt: script.inferenceRun.createdAt.toISOString(),
      completedAt: script.inferenceRun.completedAt?.toISOString() ?? null,
    },
    markets: script.markets.map((scriptMarket) => ({
      scriptMarketId: scriptMarket.id,
      layer: scriptMarket.layer,
      impactDirection: scriptMarket.impactDirection,
      confidence: decimalToString(scriptMarket.confidence),
      reason: scriptMarket.reason,
      market: {
        id: scriptMarket.market.id,
        conditionId: scriptMarket.market.conditionId,
        slug: scriptMarket.market.slug,
        question: scriptMarket.market.question,
        event: scriptMarket.market.event,
        prices: {
          bestBid: decimalToString(scriptMarket.market.bestBid),
          bestAsk: decimalToString(scriptMarket.market.bestAsk),
          lastTradePrice: decimalToString(scriptMarket.market.lastTradePrice),
        },
        volume: decimalToString(scriptMarket.market.volume),
        volume24hr: decimalToString(scriptMarket.market.volume24hr),
        liquidity: decimalToString(scriptMarket.market.liquidity),
        endDate: scriptMarket.market.endDate?.toISOString() ?? null,
        syncedAt: scriptMarket.market.syncedAt.toISOString(),
      },
      selections: scriptMarket.selections.map((selection) => ({
        selectionId: selection.id,
        outcomeId: selection.outcome.id,
        label: selection.outcome.label,
        tokenId: selection.outcome.clobTokenId,
        aiAction: selection.aiAction,
        userAction: selection.userAction,
        side: selection.side,
        orderMode: selection.orderMode,
        limitPrice: decimalToString(selection.limitPrice),
        size: decimalToString(selection.size),
        amountUsd: decimalToString(selection.amountUsd),
        confidence: decimalToString(selection.confidence),
        reason: selection.reason,
        prices: {
          price: decimalToString(selection.outcome.price),
          bestBid: decimalToString(selection.outcome.bestBid),
          bestAsk: decimalToString(selection.outcome.bestAsk),
          lastTradePrice: decimalToString(selection.outcome.lastTradePrice),
        },
      })),
    })),
    createdAt: script.createdAt.toISOString(),
    updatedAt: script.updatedAt.toISOString(),
  };
  const traceHash = `0x${hashJson(capsule)}`;
  return {
    chainId: ARC_TESTNET_CHAIN_ID,
    chainName: 'Arc Testnet',
    explorerBaseUrl: ARC_EXPLORER_BASE_URL,
    traceHash,
    calldata: traceHash,
    capsule,
  };
}

async function verifyArcTransaction(txHash: string, fromAddress: string, calldata: string) {
  try {
    const hash = txHash as `0x${string}`;
    await arcPublicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
    const transaction = await arcPublicClient.getTransaction({ hash });
    if (transaction.from.toLowerCase() !== fromAddress.toLowerCase()) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Arc proof transaction signer does not match the connected wallet');
    }
    if (transaction.input.toLowerCase() !== calldata.toLowerCase()) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Arc proof transaction calldata does not match the reasoning trace hash');
    }
  } catch (error) {
    if (error instanceof ApiException) throw error;
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'REQUEST_FAILED', 'Arc proof transaction could not be verified on Arc Testnet yet', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

function decimalToString(value: Prisma.Decimal | null): string | null {
  return value == null ? null : value.toString();
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
