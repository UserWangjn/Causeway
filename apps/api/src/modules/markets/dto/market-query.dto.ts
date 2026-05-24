import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MarketQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  marketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  marketSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  eventId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  eventSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;

  @IsOptional()
  @IsBooleanString()
  closed?: string;

  @IsOptional()
  @IsIn(['volume', 'volume24hr', 'endDate', 'syncedAt'])
  sort?: string;

  @IsOptional()
  @IsIn(['event', 'market'])
  nodeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
