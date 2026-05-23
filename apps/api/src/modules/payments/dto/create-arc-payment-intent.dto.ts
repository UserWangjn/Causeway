import { IsIn } from 'class-validator';

export const ARC_PAYMENT_SKUS = ['premium_monthly', 'premium_yearly'] as const;
export type ArcPaymentSku = typeof ARC_PAYMENT_SKUS[number];

export class CreateArcPaymentIntentDto {
  @IsIn(ARC_PAYMENT_SKUS)
  sku!: ArcPaymentSku;
}
