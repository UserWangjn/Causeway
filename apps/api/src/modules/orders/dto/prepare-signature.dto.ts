import { Type } from 'class-transformer';
import { IsEthereumAddress, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class PrepareSignatureDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  intentId!: string;

  @IsIn(['dry_run', 'real'])
  executionMode!: string;

  @IsEthereumAddress()
  walletAddress!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  chainId!: number;

  @IsOptional()
  @IsEthereumAddress()
  funderAddress?: string;
}
