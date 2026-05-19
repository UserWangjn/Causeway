import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hashToken } from '../../src/common/utils/token-hash.util';

type E2eUser = {
  id: string;
  walletAddress: string;
};

export async function createE2eAccessToken(
  app: INestApplication,
  prisma: PrismaClient,
  user: E2eUser,
  chainId = 137,
): Promise<string> {
  const jwtService = app.get(JwtService);
  const sessionId = `e2e_session_${randomUUID()}`;
  const accessToken = await jwtService.signAsync({
    sub: user.id,
    sid: sessionId,
    walletAddress: user.walletAddress,
    chainId,
  });

  await prisma.walletSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      address: user.walletAddress,
      chainId,
      nonce: `e2e_nonce_${randomUUID()}`,
      nonceExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(),
      sessionTokenHash: hashToken(accessToken),
      sessionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return accessToken;
}
