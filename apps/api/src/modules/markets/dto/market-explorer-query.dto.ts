import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class MarketSearchQueryDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class EventDetailQueryDto {
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(128)
  marketId?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(128)
  eventId?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(128)
  eventSlug?: string;
}

export class MarketHistoryQueryDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  tokenIds!: string;

  @IsOptional()
  @IsIn(['1h', '6h', '1d', '1w', '1m', 'all'])
  interval?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  fidelity?: number;
}
