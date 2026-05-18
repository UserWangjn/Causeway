import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_INTERNAL_ROUTE } from '../decorators/internal-route.decorator';
import { RATE_LIMIT_POLICY, SKIP_RATE_LIMIT, type RateLimitPolicy } from '../decorators/rate-limit.decorator';
import { ApiException } from '../errors/api.exception';
import { RATE_LIMIT_STORE, type RateLimitHit, type RateLimitStore } from './rate-limit.store';

type HeaderBag = Record<string, string | string[] | undefined>;

type RateLimitRequest = {
  headers: HeaderBag;
  ip?: string;
  method?: string;
  originalUrl?: string;
  path?: string;
  route?: {
    path?: string;
  };
  user?: {
    id: string;
  };
};

type RateLimitResponse = {
  setHeader: (name: string, value: string) => void;
};

type ResolvedRateLimitPolicy = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.isEnabled() || this.shouldSkip(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RateLimitRequest>();
    const response = context.switchToHttp().getResponse<RateLimitResponse>();
    const policy = this.resolvePolicy(context, request);
    const hit = await this.store.hit(this.buildKey(request, policy), policy.windowMs);

    this.setHeaders(response, policy, hit);

    if (hit.count > policy.limit) {
      const retryAfterSeconds = Math.max(Math.ceil((hit.resetAt.getTime() - Date.now()) / 1000), 1);
      response.setHeader('Retry-After', String(retryAfterSeconds));
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Rate limit exceeded', {
        limit: policy.limit,
        windowMs: policy.windowMs,
        resetAt: hit.resetAt.toISOString(),
      });
    }

    return true;
  }

  private isEnabled(): boolean {
    return this.config.get<boolean>('rateLimit.enabled', true);
  }

  private shouldSkip(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT, [context.getHandler(), context.getClass()]) ?? false;
  }

  private resolvePolicy(context: ExecutionContext, request: RateLimitRequest): ResolvedRateLimitPolicy {
    const metadataPolicy =
      this.reflector.getAllAndOverride<RateLimitPolicy>(RATE_LIMIT_POLICY, [context.getHandler(), context.getClass()]) ?? {};
    const defaultWindowMs = this.config.get<number>('rateLimit.windowMs', 60_000);
    const defaultLimit = this.resolveDefaultLimit(context, request);
    return {
      limit: metadataPolicy.limit ?? defaultLimit,
      windowMs: metadataPolicy.windowMs ?? defaultWindowMs,
      keyPrefix: metadataPolicy.keyPrefix ?? this.resolveDefaultKeyPrefix(context, request),
    };
  }

  private resolveDefaultLimit(context: ExecutionContext, request: RateLimitRequest): number {
    if (this.isInternal(context)) {
      return this.config.get<number>('rateLimit.internalMax', 300);
    }

    if (this.isAuthRoute(request)) {
      return this.config.get<number>('rateLimit.authMax', 20);
    }

    return this.config.get<number>('rateLimit.max', 120);
  }

  private resolveDefaultKeyPrefix(context: ExecutionContext, request: RateLimitRequest): string {
    if (this.isInternal(context)) return 'internal';
    if (this.isAuthRoute(request)) return 'auth';
    return 'api';
  }

  private isInternal(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_INTERNAL_ROUTE, [context.getHandler(), context.getClass()]) ?? false
    );
  }

  private isAuthRoute(request: RateLimitRequest): boolean {
    const path = this.getRoutePath(request).toLowerCase();
    return path === '/auth' || path.includes('/auth/');
  }

  private buildKey(request: RateLimitRequest, policy: ResolvedRateLimitPolicy): string {
    const method = request.method?.toUpperCase() ?? 'GET';
    const route = this.getRoutePath(request);
    const identity = this.getIdentity(request);
    return `rl:${policy.keyPrefix}:${method}:${route}:${identity}`;
  }

  private getRoutePath(request: RateLimitRequest): string {
    return request.route?.path ?? request.path ?? request.originalUrl ?? 'unknown-route';
  }

  private getIdentity(request: RateLimitRequest): string {
    if (request.user?.id) {
      return `user:${request.user.id}`;
    }

    const bearerToken = this.getBearerToken(request.headers);
    if (bearerToken) {
      return `token:${this.sha256(bearerToken)}`;
    }

    return `ip:${request.ip ?? 'unknown-ip'}`;
  }

  private setHeaders(response: RateLimitResponse, policy: ResolvedRateLimitPolicy, hit: RateLimitHit): void {
    response.setHeader('X-RateLimit-Limit', String(policy.limit));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(policy.limit - hit.count, 0)));
    response.setHeader('X-RateLimit-Reset', hit.resetAt.toISOString());
  }

  private getBearerToken(headers: HeaderBag): string | null {
    const authorization = this.getSingleHeader(headers, 'authorization');
    if (!authorization?.startsWith('Bearer ')) return null;
    return authorization.slice('Bearer '.length).trim();
  }

  private getSingleHeader(headers: HeaderBag, name: string): string | null {
    const value = headers[name];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
