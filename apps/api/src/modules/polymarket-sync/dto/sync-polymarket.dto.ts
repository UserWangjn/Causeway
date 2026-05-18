import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SyncPolymarketDto {
  @IsOptional()
  @IsIn(['markets', 'prices', 'portfolio'])
  scope?: string;

  @IsOptional()
  @IsIn(['full', 'incremental'])
  mode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
