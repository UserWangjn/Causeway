import { Matches } from 'class-validator';

export class VerifyArcPaymentIntentDto {
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  txHash!: `0x${string}`;
}
