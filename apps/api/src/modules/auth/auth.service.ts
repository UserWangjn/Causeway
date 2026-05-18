import { Injectable, Logger, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { getAddress, verifyMessage } from 'viem';
import { AuditService } from '../audit/audit.service';
import { addAuthDuration } from '../../common/utils/duration.util';
import { hashToken } from '../../common/utils/token-hash.util';
import { PrismaService } from '../../database/prisma.service';
import { AuthNonceDto } from './dto/auth-nonce.dto';
import { AuthVerifyDto } from './dto/auth-verify.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createNonce(dto: AuthNonceDto, requestId?: string) {
    this.assertSupportedChain(dto.chainId);
    const walletAddress = getAddress(dto.address);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const nonce = this.buildSignInMessage(walletAddress, dto.chainId, now);

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
      requestId,
      actorType: 'wallet',
      entityType: 'wallet_session',
      entityId: session.id,
      action: 'auth.nonce_created',
      after: {
        walletAddress,
        chainId: dto.chainId,
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

    const verified = await this.verifyWalletSignature(walletAddress, dto.message, dto.signature);

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
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      },
    };
  }

  private buildSignInMessage(walletAddress: string, chainId: number, issuedAt: Date): string {
    return [
      'Sign in to Causeway',
      '',
      `Address: ${walletAddress}`,
      `Chain ID: ${chainId}`,
      `Nonce: ${randomUUID()}`,
      `Issued At: ${issuedAt.toISOString()}`,
    ].join('\n');
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

  private async verifyWalletSignature(walletAddress: string, message: string, signature: string): Promise<boolean> {
    try {
      return await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      return false;
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
