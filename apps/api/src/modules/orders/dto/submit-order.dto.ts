import { Transform, type TransformFnParams } from 'class-transformer';
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
  // Keep polymorphic signed order items intact; implicit conversion turns objects into Array instances.
  @Transform(preserveSignedOrders, { toClassOnly: true })
  signedOrders!: unknown[];
}

function preserveSignedOrders(params: TransformFnParams): unknown {
  const sourceObject = params.obj as unknown;
  if (isRecord(sourceObject) && 'signedOrders' in sourceObject) {
    return sourceObject.signedOrders;
  }
  return params.value as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
