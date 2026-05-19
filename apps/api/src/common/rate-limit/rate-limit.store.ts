export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

export type RateLimitHit = {
  count: number;
  resetAt: Date;
};

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
  healthCheck(): Promise<void>;
}
