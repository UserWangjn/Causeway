import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_POLICY = 'causeway:rateLimitPolicy';
export const SKIP_RATE_LIMIT = 'causeway:skipRateLimit';

export type RateLimitPolicy = {
  limit?: number;
  windowMs?: number;
  keyPrefix?: string;
};

export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_POLICY, policy);

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT, true);
