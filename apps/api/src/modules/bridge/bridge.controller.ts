import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { BridgeService } from './bridge.service';
import { BridgeQuoteDto } from './dto/bridge-quote.dto';
import { BridgeStatusParamDto } from './dto/bridge-status-param.dto';
import { BridgeWithdrawDto } from './dto/bridge-withdraw.dto';

@Controller('bridge')
export class BridgeController {
  constructor(@Inject(BridgeService) private readonly bridgeService: BridgeService) {}

  @Get('wallet')
  wallet(@CurrentUser() user: CurrentUserType) {
    return this.bridgeService.getWallet(user);
  }

  @Get('supported-assets')
  supportedAssets() {
    return this.bridgeService.getSupportedAssets();
  }

  @Post('deposit')
  deposit(@CurrentUser() user: CurrentUserType) {
    return this.bridgeService.createDeposit(user);
  }

  @Post('quote')
  quote(@Body(createDtoValidationPipe(BridgeQuoteDto)) dto: BridgeQuoteDto) {
    return this.bridgeService.getQuote(dto);
  }

  @Post('withdraw')
  withdraw(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(BridgeWithdrawDto)) dto: BridgeWithdrawDto,
  ) {
    return this.bridgeService.createWithdrawal(user, dto);
  }

  @Get('status/:address')
  status(@Param(createDtoValidationPipe(BridgeStatusParamDto)) params: BridgeStatusParamDto) {
    return this.bridgeService.getStatus(params.address);
  }
}
