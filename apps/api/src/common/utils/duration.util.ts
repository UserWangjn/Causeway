export const AUTH_DURATION_PATTERN = /^(\d+)([smhd])$/;

export function parseAuthDurationMs(value: string): number {
  const match = AUTH_DURATION_PATTERN.exec(value);
  if (!match) {
    throw new Error('Duration must use the format <number><s|m|h|d>');
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * multiplier;
}

export function addAuthDuration(base: Date, duration: string): Date {
  return new Date(base.getTime() + parseAuthDurationMs(duration));
}
