import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SyncPolymarketDto {
  @IsOptional()
  @IsIn(['markets', 'prices', 'portfolio'])
  scope?: string;

  @IsOptional()
  @IsIn(['full', 'incremental', 'hot'])
  mode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  hotEventLimit?: number;
}
