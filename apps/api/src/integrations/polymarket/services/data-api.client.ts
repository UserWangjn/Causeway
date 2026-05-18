import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DataApiClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('polymarket.dataBaseUrl', 'https://data-api.polymarket.com');
  }

  getCapability() {
    return {
      status: 'unavailable' as const,
      reason: `Portfolio data source is not wired yet (${this.baseUrl})`,
    };
  }
}
