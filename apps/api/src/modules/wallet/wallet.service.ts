import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletService {
  constructor(private readonly config: ConfigService) {}

  isSupportedChain(chainId: number) {
    return this.config.get<number[]>('auth.supportedChainIds', [137]).includes(chainId);
  }
}
