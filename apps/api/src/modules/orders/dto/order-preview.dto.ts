import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class OrderPreviewSelectionDto {
  @IsString()
  selectionId!: string;

  @IsIn(['market', 'limit'])
  orderMode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amountUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  size?: number;

  @ValidateIf((selection: OrderPreviewSelectionDto) => selection.orderMode === 'limit')
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  limitPrice?: number;

  @IsOptional()
  @IsIn(['GTC', 'GTD', 'FOK', 'FAK'])
  orderType?: string;
}

export class OrderPreviewDto {
  @IsString()
  scriptId!: string;

  @IsIn(['dry_run', 'real'])
  executionMode!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderPreviewSelectionDto)
  selections!: OrderPreviewSelectionDto[];
}
