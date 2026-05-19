import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  isSupportedChain(chainId: number) {
    return this.config.get<number[]>('auth.supportedChainIds', [137]).includes(chainId);
  }
}
