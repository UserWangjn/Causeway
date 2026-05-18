import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUser = {
  id: string;
  walletAddress: string;
  chainId: number;
  requestId?: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUser | null => {
  const request = ctx.switchToHttp().getRequest<{ user?: CurrentUser }>();
  return request.user ?? null;
});
