import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('summary')
  summary(@CurrentUser() user: CurrentUserType) {
    return this.portfolioService.summary(user);
  }

  @Get('positions')
  positions(@CurrentUser() user: CurrentUserType) {
    return this.portfolioService.positions(user);
  }

  @Get('orders')
  orders(@CurrentUser() user: CurrentUserType, @Query('status') status?: string) {
    return this.portfolioService.orders(user, status);
  }

  @Get('trades')
  trades(@CurrentUser() user: CurrentUserType) {
    return this.portfolioService.trades(user);
  }
}
