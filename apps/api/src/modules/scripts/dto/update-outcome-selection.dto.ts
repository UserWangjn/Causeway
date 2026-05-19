import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateOutcomeSelectionDto {
  @IsOptional()
  @IsIn(['buy', 'skip'])
  userAction?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
