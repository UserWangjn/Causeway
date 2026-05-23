import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { CompleteClobAuthDto } from './dto/complete-clob-auth.dto';
import {
  CompleteDepositWalletApprovalDto,
  CompleteDepositWalletFundingDto,
  CompleteDepositWalletTransferDto,
  PrepareDepositWalletTransferDto,
} from './dto/deposit-wallet-approval.dto';
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

  @Post('deposit-wallet/approve/prepare')
  prepareDepositWalletApproval(@CurrentUser() user: CurrentUserType) {
    return this.tradingService.prepareDepositWalletApproval(user);
  }

  @Post('deposit-wallet/approve/complete')
  completeDepositWalletApproval(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(CompleteDepositWalletApprovalDto)) dto: CompleteDepositWalletApprovalDto,
  ) {
    return this.tradingService.completeDepositWalletApproval(user, dto);
  }

  @Post('deposit-wallet/fund-safe/prepare')
  prepareSafeDepositWalletFunding(@CurrentUser() user: CurrentUserType, @Body('amountMicroUsd') amountMicroUsd?: number) {
    return this.tradingService.prepareSafeDepositWalletFunding(user, amountMicroUsd);
  }

  @Post('deposit-wallet/fund-safe/complete')
  completeSafeDepositWalletFunding(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(CompleteDepositWalletFundingDto)) dto: CompleteDepositWalletFundingDto,
  ) {
    return this.tradingService.completeSafeDepositWalletFunding(user, dto);
  }

  @Post('deposit-wallet/transfer/prepare')
  prepareDepositWalletTransfer(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(PrepareDepositWalletTransferDto)) dto: PrepareDepositWalletTransferDto,
  ) {
    return this.tradingService.prepareDepositWalletTransfer(user, dto);
  }

  @Post('deposit-wallet/transfer/complete')
  completeDepositWalletTransfer(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(CompleteDepositWalletTransferDto)) dto: CompleteDepositWalletTransferDto,
  ) {
    return this.tradingService.completeDepositWalletTransfer(user, dto);
  }

  @Get('relayer-transactions/:transactionId')
  relayerTransaction(@CurrentUser() user: CurrentUserType, @Param('transactionId') transactionId: string) {
    return this.tradingService.getRelayerTransactionStatus(user, transactionId);
  }
}
