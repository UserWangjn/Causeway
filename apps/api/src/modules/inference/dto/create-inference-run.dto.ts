import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class CreateInferenceRunDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  rootMarketId!: string;

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
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

  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  model!: string;

  @IsOptional()
  @IsBoolean()
  cacheEnabled?: boolean;
}
