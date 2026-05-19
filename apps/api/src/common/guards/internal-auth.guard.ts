import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type HeaderBag = Record<string, string | string[] | undefined>;

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.config.get<string>('internal.apiToken');
    if (!expectedToken) {
      throw new UnauthorizedException({
        code: 'INTERNAL_AUTH_NOT_CONFIGURED',
        message: 'Internal API token is not configured',
      });
    }

    const request = context.switchToHttp().getRequest<{ headers: HeaderBag }>();
    const providedToken = this.getSingleHeader(request.headers, 'x-internal-api-token') ?? this.getBearerToken(request.headers);

    if (providedToken !== expectedToken) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Valid internal API token is required',
      });
    }

    return true;
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
}
