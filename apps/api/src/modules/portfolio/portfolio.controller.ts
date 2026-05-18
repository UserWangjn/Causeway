import { Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, type CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { PortfolioOrdersQueryDto } from './dto/portfolio-orders-query.dto';
import { PortfolioTradesQueryDto } from './dto/portfolio-trades-query.dto';
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

  @Post('positions/sync')
  syncPositions(@CurrentUser() user: CurrentUserType) {
    return this.portfolioService.syncPositions(user);
  }

  @Get('orders')
  orders(@CurrentUser() user: CurrentUserType, @Query() query: PortfolioOrdersQueryDto) {
    return this.portfolioService.orders(user, query);
  }

  @Get('trades')
  trades(@CurrentUser() user: CurrentUserType, @Query() query: PortfolioTradesQueryDto) {
    return this.portfolioService.trades(user, query);
  }
}
