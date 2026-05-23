import { IsUUID } from 'class-validator';

export class ArcPaymentIntentParamDto {
  @IsUUID()
  intentId!: string;
}
