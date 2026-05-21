import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { CompleteClobAuthDto } from './dto/complete-clob-auth.dto';
import { TradingService } from './trading.service';
import { normalizeTradingAccountType } from './trading-account-type';

@Controller('trading')
export class TradingController {
  constructor(@Inject(TradingService) private readonly tradingService: TradingService) {}

  @Get('readiness')
  readiness(@CurrentUser() user: CurrentUserType, @Query('tradingAccountType') tradingAccountType?: string) {
    return this.tradingService.getReadiness(user, {
      refreshExternal: true,
      tradingAccountType: normalizeTradingAccountType(tradingAccountType),
    });
  }

  @Post('clob-auth/prepare')
  prepareClobAuth(@CurrentUser() user: CurrentUserType) {
    return this.tradingService.prepareClobAuth(user);
  }

  @Post('clob-auth/complete')
  completeClobAuth(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(CompleteClobAuthDto)) dto: CompleteClobAuthDto,
  ) {
    return this.tradingService.completeClobAuth(user, dto);
  }

  @Post('deposit-wallet/ensure')
  ensureDepositWallet(@CurrentUser() user: CurrentUserType) {
    return this.tradingService.ensureDepositWallet(user);
  }
}
