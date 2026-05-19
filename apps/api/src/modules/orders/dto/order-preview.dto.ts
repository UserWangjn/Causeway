import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class OrderPreviewSelectionDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
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
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  scriptId!: string;

  @IsIn(['dry_run', 'real'])
  executionMode!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderPreviewSelectionDto)
  selections!: OrderPreviewSelectionDto[];
}
