import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class CreateDirectOrderScriptDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  marketId!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  outcomeId!: string;

  @IsOptional()
  @IsIn(['market', 'limit'])
  orderMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  limitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  size?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amountUsd?: number;
}
