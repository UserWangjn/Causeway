import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { MarketQueryDto } from './dto/market-query.dto';
import { MarketsService } from './markets.service';

@PublicRoute()
@Controller()
export class MarketsController {
  constructor(@Inject(MarketsService) private readonly marketsService: MarketsService) {}

  @Get('markets')
  listMarkets(@Query(createDtoValidationPipe(MarketQueryDto)) query: MarketQueryDto) {
    return this.marketsService.listMarkets(query);
  }

  @Get('markets/by-slug/:slug')
  getMarketBySlug(@Param('slug') slug: string) {
    return this.marketsService.getMarketBySlug(slug);
  }

  @Get('markets/:marketId')
  getMarket(@Param('marketId') marketId: string) {
    return this.marketsService.getMarket(marketId);
  }

  @Get('markets/:marketId/orderbook')
  getOrderBook(@Param('marketId') marketId: string, @Query('tokenId') tokenId: string) {
    return this.marketsService.getOrderBook(marketId, tokenId);
  }

  @Get('market-network')
  getMarketNetwork(@Query(createDtoValidationPipe(MarketQueryDto)) query: MarketQueryDto) {
    return this.marketsService.getMarketNetwork(query);
  }
}
