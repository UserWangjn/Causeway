import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class SubmitOrderDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  intentId!: string;

  @IsIn(['dry_run', 'real'])
  executionMode!: string;

  @TrimString()
  @IsUUID()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMaxSize(50)
  signedOrders!: unknown[];
}
