import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { MarketQueryDto } from './dto/market-query.dto';
import { MarketIdParamDto, MarketOrderBookQueryDto, MarketSlugParamDto } from './dto/market-route.dto';
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
  getMarketBySlug(@Param(createDtoValidationPipe(MarketSlugParamDto)) params: MarketSlugParamDto) {
    return this.marketsService.getMarketBySlug(params.slug);
  }

  @Get('markets/:marketId')
  getMarket(@Param(createDtoValidationPipe(MarketIdParamDto)) params: MarketIdParamDto) {
    return this.marketsService.getMarket(params.marketId);
  }

  @Get('markets/:marketId/orderbook')
  getOrderBook(
    @Param(createDtoValidationPipe(MarketIdParamDto)) params: MarketIdParamDto,
    @Query(createDtoValidationPipe(MarketOrderBookQueryDto)) query: MarketOrderBookQueryDto,
  ) {
    return this.marketsService.getOrderBook(params.marketId, query.tokenId);
  }

  @Get('market-network')
  getMarketNetwork(@Query(createDtoValidationPipe(MarketQueryDto)) query: MarketQueryDto) {
    return this.marketsService.getMarketNetwork(query);
  }
}
