import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_INTERNAL_ROUTE } from '../decorators/internal-route.decorator';
import { IS_PUBLIC_ROUTE } from '../decorators/public-route.decorator';
import type { CurrentUser } from '../decorators/current-user.decorator';
import { hashToken } from '../utils/token-hash.util';
import { PrismaService } from '../../database/prisma.service';

type JwtPayload = {
  sub: string;
  sid: string;
  walletAddress: string;
  chainId: number;
};

type RequestWithAuth = {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
  user?: CurrentUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context) || this.isInternal(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = this.getBearerToken(request.headers);
    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authorization bearer token is required',
      });
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authorization bearer token is invalid or expired',
      });
    }
    if (!payload.sid) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authorization bearer token is missing session information',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, walletAddress: true },
    });

    if (!user || user.walletAddress.toLowerCase() !== payload.walletAddress.toLowerCase()) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authenticated user no longer exists',
      });
    }
    const session = await this.prisma.walletSession.findFirst({
      where: {
        id: payload.sid,
        userId: user.id,
        sessionTokenHash: hashToken(token),
        sessionExpiresAt: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authenticated session is no longer valid',
      });
    }

    request.user = {
      id: user.id,
      walletAddress: user.walletAddress,
      chainId: payload.chainId,
      requestId: request.requestId,
    };

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [context.getHandler(), context.getClass()]) ?? false
    );
  }

  private isInternal(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_INTERNAL_ROUTE, [context.getHandler(), context.getClass()]) ?? false
    );
  }

  private getBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
    const raw = headers.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;
    if (!authorization?.startsWith('Bearer ')) return null;
    return authorization.slice('Bearer '.length).trim();
  }
}
