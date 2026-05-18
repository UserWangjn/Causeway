import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../../common/errors/api.exception';

export type AiClientCapability = {
  status: 'available' | 'unavailable';
  reason: string | null;
};

@Injectable()
export class AiClientService {
  constructor(private readonly config: ConfigService) {}

  getCapability(): AiClientCapability {
    const baseUrl = this.config.get<string>('ai.baseUrl');
    const apiKey = this.config.get<string>('ai.apiKey');
    const model = this.config.get<string>('ai.model');
    if (!baseUrl || !apiKey || !model) {
      return {
        status: 'unavailable',
        reason: 'AI inference client is not configured',
      };
    }

    return {
      status: 'unavailable',
      reason: 'AI inference provider adapter is not implemented yet',
    };
  }

  runStructuredInference<TOutput>(_input: unknown): Promise<TOutput> {
    const capability = this.getCapability();
    return Promise.reject(
      new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        capability.reason ?? 'AI inference client is unavailable',
      ),
    );
  }
}
