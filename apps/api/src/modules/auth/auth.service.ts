import { Inject, Injectable, Logger, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, getAddress, http, verifyMessage, type Hex } from 'viem';
import { polygon } from 'viem/chains';
import { createSiweMessage, generateSiweNonce, parseSiweMessage, verifySiweMessage } from 'viem/siwe';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { addAuthDuration } from '../../common/utils/duration.util';
import { hashToken } from '../../common/utils/token-hash.util';
import { PrismaService } from '../../database/prisma.service';
import { AuthNonceDto } from './dto/auth-nonce.dto';
import { AuthVerifyDto } from './dto/auth-verify.dto';

type AuthRequestContext = {
  origin?: string | null;
  requestId?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly publicClients = new Map<number, ReturnType<typeof createPublicClient>>();

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly audit: AuditService,
  ) {}

  async createNonce(dto: AuthNonceDto, context: AuthRequestContext = {}) {
    this.assertSupportedChain(dto.chainId);
    const walletAddress = getAddress(dto.address);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const siweUrl = this.resolveSiweUrl(context.origin);
    const nonce = createSiweMessage({
      address: walletAddress,
      chainId: dto.chainId,
      domain: siweUrl.host,
      expirationTime: expiresAt,
      issuedAt: now,
      nonce: generateSiweNonce(),
      requestId: context.requestId ?? undefined,
      statement: this.config.get<string>('auth.siweStatement', 'Sign in to Causeway.'),
      uri: siweUrl.toString(),
      version: '1',
    });

    const session = await this.prisma.walletSession.create({
      data: {
        address: walletAddress,
        chainId: dto.chainId,
        nonce,
        nonceExpiresAt: expiresAt,
      },
    });
    await this.safeAudit({
      userId: null,
      requestId: context.requestId,
      actorType: 'wallet',
      entityType: 'wallet_session',
      entityId: session.id,
      action: 'auth.nonce_created',
      after: {
        walletAddress,
        chainId: dto.chainId,
        domain: siweUrl.host,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      nonce,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verify(dto: AuthVerifyDto, requestId?: string) {
    this.assertSupportedChain(dto.chainId);
    const walletAddress = getAddress(dto.address);
    const session = await this.prisma.walletSession.findFirst({
      where: {
        address: walletAddress,
        chainId: dto.chainId,
        nonce: dto.message,
        verifiedAt: null,
        nonceExpiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      await this.safeAudit({
        userId: null,
        requestId,
        actorType: 'wallet',
        entityType: 'wallet',
        entityId: walletAddress,
        action: 'auth.verify_failed',
        reason: 'nonce_missing_expired_or_used',
        after: {
          walletAddress,
          chainId: dto.chainId,
        },
      });
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Sign-in nonce is missing, expired, or already used',
      });
    }

    let siweMessage: { domain: string; nonce: string };
    try {
      siweMessage = this.parseAndAssertSiweMessage(dto.message, walletAddress, dto.chainId);
    } catch (error) {
      await this.safeAudit({
        userId: session.userId,
        requestId,
        actorType: 'wallet',
        entityType: 'wallet_session',
        entityId: session.id,
        action: 'auth.verify_failed',
        reason: 'invalid_siwe_message',
        after: {
          walletAddress,
          chainId: dto.chainId,
        },
      });
      throw error;
    }
    const verified = await this.verifyWalletSignature({
      chainId: dto.chainId,
      domain: siweMessage.domain,
      message: dto.message,
      nonce: siweMessage.nonce,
      signature: dto.signature,
      walletAddress,
    });

    if (!verified) {
      await this.safeAudit({
        userId: session.userId,
        requestId,
        actorType: 'wallet',
        entityType: 'wallet_session',
        entityId: session.id,
        action: 'auth.verify_failed',
        reason: 'invalid_signature',
        after: {
          walletAddress,
          chainId: dto.chainId,
        },
      });
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Wallet signature is invalid',
      });
    }

    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
      select: { id: true, walletAddress: true },
    });

    const sessionExpiresAt = this.resolveSessionExpiry();
    const verifiedAt = new Date();
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sid: session.id,
      walletAddress: user.walletAddress,
      chainId: dto.chainId,
    });
    const consumed = await this.prisma.walletSession.updateMany({
      where: {
        id: session.id,
        verifiedAt: null,
        nonceExpiresAt: {
          gt: verifiedAt,
        },
      },
      data: {
        userId: user.id,
        verifiedAt,
        sessionTokenHash: hashToken(accessToken),
        sessionExpiresAt,
      },
    });

    if (consumed.count !== 1) {
      await this.safeAudit({
        userId: user.id,
        requestId,
        actorType: 'wallet',
        entityType: 'wallet_session',
        entityId: session.id,
        action: 'auth.verify_failed',
        reason: 'nonce_already_consumed',
        after: {
          walletAddress: user.walletAddress,
          chainId: dto.chainId,
        },
      });
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Sign-in nonce is missing, expired, or already used',
      });
    }

    await this.safeAudit({
      userId: user.id,
      requestId,
      actorType: 'wallet',
      entityType: 'wallet_session',
      entityId: session.id,
      action: 'auth.verified',
      after: {
        walletAddress: user.walletAddress,
        chainId: dto.chainId,
      },
    });

    return {
      accessToken,
      expiresAt: sessionExpiresAt.toISOString(),
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      },
    };
  }

  async logout(user: CurrentUser, accessToken: string, requestId?: string) {
    const loggedOutAt = new Date();
    const revoked = await this.prisma.walletSession.updateMany({
      where: {
        id: user.sessionId,
        userId: user.id,
        sessionTokenHash: hashToken(accessToken),
        sessionExpiresAt: {
          gt: loggedOutAt,
        },
      },
      data: {
        sessionExpiresAt: loggedOutAt,
      },
    });

    await this.safeAudit({
      userId: user.id,
      requestId,
      actorType: 'wallet',
      entityType: 'wallet_session',
      entityId: user.sessionId,
      action: 'auth.logged_out',
      after: {
        walletAddress: user.walletAddress,
        chainId: user.chainId,
        revoked: revoked.count === 1,
      },
    });

    return {
      revoked: revoked.count === 1,
    };
  }

  private assertSupportedChain(chainId: number) {
    const supportedChainIds = this.config.get<number[]>('auth.supportedChainIds', [137]);
    if (!supportedChainIds.includes(chainId)) {
      throw new UnprocessableEntityException({
        code: 'UNSUPPORTED_CHAIN',
        message: `Chain ${chainId} is not supported`,
        details: { supportedChainIds },
      });
    }
  }

  private parseAndAssertSiweMessage(message: string, walletAddress: string, chainId: number): { domain: string; nonce: string } {
    const parsed = parseSiweMessage(message);
    if (
      !parsed.address ||
      parsed.address.toLowerCase() !== walletAddress.toLowerCase() ||
      parsed.chainId !== chainId ||
      !parsed.domain ||
      !parsed.nonce
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Sign-in message does not match the requested wallet session',
      });
    }

    return {
      domain: parsed.domain,
      nonce: parsed.nonce,
    };
  }

  private async verifyWalletSignature(input: {
    chainId: number;
    domain: string;
    message: string;
    nonce: string;
    signature: string;
    walletAddress: string;
  }): Promise<boolean> {
    try {
      const eoaVerified = await verifyMessage({
        address: input.walletAddress as `0x${string}`,
        message: input.message,
        signature: input.signature as Hex,
      });
      if (eoaVerified) return true;

      return await verifySiweMessage(this.getPublicClient(input.chainId), {
        address: input.walletAddress as `0x${string}`,
        domain: input.domain,
        message: input.message,
        nonce: input.nonce,
        signature: input.signature as Hex,
      });
    } catch {
      return false;
    }
  }

  private getPublicClient(chainId: number): ReturnType<typeof createPublicClient> {
    const cached = this.publicClients.get(chainId);
    if (cached) return cached;
    if (chainId !== polygon.id) {
      throw new UnprocessableEntityException({
        code: 'UNSUPPORTED_CHAIN',
        message: `Chain ${chainId} is not supported for SIWE verification`,
        details: { supportedChainIds: [polygon.id] },
      });
    }

    const client = createPublicClient({
      chain: polygon,
      transport: http(this.config.get<string>('auth.polygonRpcUrl') || undefined),
    });
    this.publicClients.set(chainId, client);
    return client;
  }

  private resolveSiweUrl(origin?: string | null): URL {
    if (origin) {
      const originUrl = this.parseUrl(origin, 'Origin');
      if (!this.isAllowedSiweOrigin(originUrl)) {
        throw new UnprocessableEntityException({
          code: 'UNTRUSTED_ORIGIN',
          message: 'Sign-in origin is not allowed',
        });
      }
      return originUrl;
    }

    const configuredUri = this.config.get<string>('auth.siweUri');
    if (configuredUri) return this.parseUrl(configuredUri, 'AUTH_SIWE_URI');

    const [firstCorsOrigin] = this.config.get<string[]>('api.corsOrigins', []);
    if (firstCorsOrigin) return this.parseUrl(firstCorsOrigin, 'API_CORS_ORIGINS');

    throw new UnprocessableEntityException({
      code: 'AUTH_CONFIGURATION_INVALID',
      message: 'A trusted frontend origin is required for SIWE login',
    });
  }

  private isAllowedSiweOrigin(originUrl: URL): boolean {
    const configuredUri = this.config.get<string>('auth.siweUri');
    const allowedOrigins = new Set(this.config.get<string[]>('api.corsOrigins', []));
    if (configuredUri) {
      allowedOrigins.add(this.parseUrl(configuredUri, 'AUTH_SIWE_URI').origin);
    }
    return allowedOrigins.has(originUrl.origin);
  }

  private parseUrl(value: string, field: string): URL {
    try {
      return new URL(value);
    } catch {
      throw new UnprocessableEntityException({
        code: 'AUTH_CONFIGURATION_INVALID',
        message: `${field} must be a valid URL`,
      });
    }
  }

  private async safeAudit(input: {
    userId?: string | null;
    requestId?: string | null;
    actorType: string;
    entityType: string;
    entityId: string;
    action: string;
    after?: unknown;
    reason?: string | null;
  }): Promise<void> {
    try {
      await this.audit.record(input);
    } catch (error) {
      this.logger.error('Failed to persist audit event', error instanceof Error ? error.stack : String(error));
    }
  }

  private resolveSessionExpiry(): Date {
    const expiresIn = this.config.get<string>('auth.jwtExpiresIn', '7d');
    return addAuthDuration(new Date(), expiresIn);
  }
}
