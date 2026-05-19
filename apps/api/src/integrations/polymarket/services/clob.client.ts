import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../../common/errors/api.exception';
import type { OrderBookSnapshot } from '../types';

export type TradingCapabilityStatus = 'available' | 'degraded' | 'unavailable';

@Injectable()
export class ClobClient {
  private readonly baseUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.baseUrl = config.get<string>('polymarket.clobBaseUrl', 'https://clob.polymarket.com');
  }

  getOrderBook(tokenId: string): Promise<OrderBookSnapshot> {
    return Promise.reject(
      new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'ORDERBOOK_UNAVAILABLE', 'CLOB order book is not wired yet', {
        tokenId,
        baseUrl: this.baseUrl,
      }),
    );
  }

  getCapability() {
    return {
      status: 'unavailable' as TradingCapabilityStatus,
      reason: `CLOB real trading is not wired yet (${this.baseUrl})`,
    };
  }
}
