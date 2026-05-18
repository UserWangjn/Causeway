import { Body, Controller, Post } from '@nestjs/common';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { AuthNonceDto } from './dto/auth-nonce.dto';
import { AuthVerifyDto } from './dto/auth-verify.dto';
import { AuthService } from './auth.service';

@PublicRoute()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  createNonce(@Body() dto: AuthNonceDto) {
    return this.authService.createNonce(dto);
  }

  @Post('verify')
  verify(@Body() dto: AuthVerifyDto) {
    return this.authService.verify(dto);
  }
}
