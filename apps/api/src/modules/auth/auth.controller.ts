import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthNonceDto } from './dto/auth-nonce.dto';
import { AuthVerifyDto } from './dto/auth-verify.dto';
import { AuthService } from './auth.service';

type RequestWithId = {
  headers?: Record<string, string | string[] | undefined>;
  requestId?: string;
};

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('nonce')
  @PublicRoute()
  createNonce(@Body(createDtoValidationPipe(AuthNonceDto)) dto: AuthNonceDto, @Req() request: RequestWithId) {
    return this.authService.createNonce(dto, {
      origin: getHeader(request, 'origin'),
      requestId: request.requestId,
    });
  }

  @Post('verify')
  @PublicRoute()
  verify(@Body(createDtoValidationPipe(AuthVerifyDto)) dto: AuthVerifyDto, @Req() request: RequestWithId) {
    return this.authService.verify(dto, request.requestId);
  }

  @Post('logout')
  logout(@CurrentUser() user: CurrentUserType, @Req() request: RequestWithId) {
    return this.authService.logout(user, getBearerToken(request), request.requestId);
  }
}

function getHeader(request: RequestWithId, name: string): string | undefined {
  const raw = request.headers?.[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

function getBearerToken(request: RequestWithId): string {
  const authorization = getHeader(request, 'authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
}
