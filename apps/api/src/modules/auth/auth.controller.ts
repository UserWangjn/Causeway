import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { AuthNonceDto } from './dto/auth-nonce.dto';
import { AuthVerifyDto } from './dto/auth-verify.dto';
import { AuthService } from './auth.service';

type RequestWithId = {
  requestId?: string;
};

@PublicRoute()
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('nonce')
  createNonce(@Body(createDtoValidationPipe(AuthNonceDto)) dto: AuthNonceDto, @Req() request: RequestWithId) {
    return this.authService.createNonce(dto, request.requestId);
  }

  @Post('verify')
  verify(@Body(createDtoValidationPipe(AuthVerifyDto)) dto: AuthVerifyDto, @Req() request: RequestWithId) {
    return this.authService.verify(dto, request.requestId);
  }
}
