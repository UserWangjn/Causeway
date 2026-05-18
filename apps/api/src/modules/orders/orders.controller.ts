import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { OrderPreviewDto } from './dto/order-preview.dto';
import { PrepareSignatureDto } from './dto/prepare-signature.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('preview')
  preview(@CurrentUser() user: CurrentUserType, @Body() dto: OrderPreviewDto) {
    return this.ordersService.preview(user, dto);
  }

  @Post('prepare-signature')
  prepareSignature(@CurrentUser() user: CurrentUserType, @Body() dto: PrepareSignatureDto) {
    return this.ordersService.prepareSignature(user, dto);
  }

  @Post('submit')
  submit(@CurrentUser() user: CurrentUserType, @Body() dto: SubmitOrderDto) {
    return this.ordersService.submit(user, dto);
  }

  @Get('intents/:intentId')
  getIntent(@CurrentUser() user: CurrentUserType, @Param('intentId') intentId: string) {
    return this.ordersService.getIntent(user, intentId);
  }
}
