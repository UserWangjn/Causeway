import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { OrderIntentParamDto } from './dto/order-intent-param.dto';
import { OrderPreviewDto } from './dto/order-preview.dto';
import { PrepareSignatureDto } from './dto/prepare-signature.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Post('preview')
  preview(@CurrentUser() user: CurrentUserType, @Body(createDtoValidationPipe(OrderPreviewDto)) dto: OrderPreviewDto) {
    return this.ordersService.preview(user, dto);
  }

  @Post('prepare-signature')
  prepareSignature(@CurrentUser() user: CurrentUserType, @Body(createDtoValidationPipe(PrepareSignatureDto)) dto: PrepareSignatureDto) {
    return this.ordersService.prepareSignature(user, dto);
  }

  @Post('submit')
  submit(
    @CurrentUser() user: CurrentUserType,
    @Body(createDtoValidationPipe(SubmitOrderDto)) dto: SubmitOrderDto,
    @Headers('x-causeway-client-version') clientVersion?: string | string[],
    @Headers('x-causeway-signed-orders-shape') clientSignedOrdersShape?: string | string[],
  ) {
    return this.ordersService.submit(user, dto, {
      clientVersion: Array.isArray(clientVersion) ? clientVersion[0] : clientVersion,
      clientSignedOrdersShape: Array.isArray(clientSignedOrdersShape) ? clientSignedOrdersShape[0] : clientSignedOrdersShape,
    });
  }

  @Get('intents/:intentId')
  getIntent(@CurrentUser() user: CurrentUserType, @Param(createDtoValidationPipe(OrderIntentParamDto)) params: OrderIntentParamDto) {
    return this.ordersService.getIntent(user, params.intentId);
  }
}
