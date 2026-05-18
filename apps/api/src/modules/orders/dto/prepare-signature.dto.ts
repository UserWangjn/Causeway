import { Type } from 'class-transformer';
import { IsEthereumAddress, IsIn, IsInt, IsString, Min } from 'class-validator';

export class PrepareSignatureDto {
  @IsString()
  intentId!: string;

  @IsIn(['dry_run', 'real'])
  executionMode!: string;

  @IsEthereumAddress()
  walletAddress!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  chainId!: number;
}
