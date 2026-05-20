import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export const SCRIPT_LIST_STATUSES = ['draft', 'active', 'archived'] as const;
export type ScriptListStatus = typeof SCRIPT_LIST_STATUSES[number];

export class ListScriptsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @IsIn(SCRIPT_LIST_STATUSES)
  status?: ScriptListStatus;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(200)
  q?: string;
}
