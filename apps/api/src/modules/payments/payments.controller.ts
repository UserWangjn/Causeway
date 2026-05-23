import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { ArcPaymentIntentParamDto } from './dto/arc-payment-intent-param.dto';
import { CreateArcPaymentIntentDto } from './dto/create-arc-payment-intent.dto';
import { VerifyArcPaymentIntentDto } from './dto/verify-arc-payment-intent.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @PublicRoute()
  @Get('membership/catalog')
  catalog() {
    return this.paymentsService.getCatalog();
  }

  @Get('membership/me')
  membership(@CurrentUser() user: CurrentUserType) {
    return this.paymentsService.getMembership(user);
  }

  @Post('payments/arc-usdc/intents')
  createArcUsdcIntent(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(CreateArcPaymentIntentDto)) dto: CreateArcPaymentIntentDto,
  ) {
    return this.paymentsService.createArcUsdcIntent(user, dto);
  }

  @Get('payments/arc-usdc/intents/:intentId')
  getArcUsdcIntent(
    @CurrentUser() user: CurrentUserType,
    @Param(createDtoValidationPipe(ArcPaymentIntentParamDto)) params: ArcPaymentIntentParamDto,
  ) {
    return this.paymentsService.getArcUsdcIntent(user, params.intentId);
  }

  @Post('payments/arc-usdc/intents/:intentId/verify')
  verifyArcUsdcIntent(
    @CurrentUser() user: CurrentUserType,
    @Param(createDtoValidationPipe(ArcPaymentIntentParamDto)) params: ArcPaymentIntentParamDto,
    @Body(createDtoValidationPipe(VerifyArcPaymentIntentDto)) dto: VerifyArcPaymentIntentDto,
  ) {
    return this.paymentsService.verifyArcUsdcIntent(user, params.intentId, dto);
  }
}
