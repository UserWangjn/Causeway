import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api.exception';

@Injectable()
export class AiClientService {
  runStructuredInference<TOutput>(_input: unknown): Promise<TOutput> {
    return Promise.reject(
      new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'AI inference client is not configured'),
    );
  }
}
