import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateInferenceRunDto {
  @IsString()
  rootMarketId!: string;

  @IsString()
  rootOutcomeId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  depth!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxMarketsPerLayer!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold!: number;

  @IsString()
  model!: string;

  @IsOptional()
  @IsBoolean()
  cacheEnabled?: boolean;
}
