import { IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class CompleteArcProofDto {
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  txHash!: string;

  @IsInt()
  chainId!: number;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  fromAddress!: string;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  traceHash!: string;

  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]+$/)
  calldata?: string;
}
