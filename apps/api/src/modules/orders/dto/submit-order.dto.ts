import { IsArray, IsIn, IsString, IsUUID } from 'class-validator';

export class SubmitOrderDto {
  @IsString()
  intentId!: string;

  @IsIn(['dry_run', 'real'])
  executionMode!: string;

  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  signedOrders!: unknown[];
}
