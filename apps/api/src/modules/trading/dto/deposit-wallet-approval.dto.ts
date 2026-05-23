import { IsInt, IsString, Matches, Min } from 'class-validator';

export class CompleteDepositWalletApprovalDto {
  @IsString()
  @Matches(/^\d+$/)
  nonce!: string;

  @IsString()
  @Matches(/^\d+$/)
  deadline!: string;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  signature!: string;
}

export class CompleteDepositWalletFundingDto {
  @IsInt()
  @Min(1)
  amountMicroUsd!: number;

  @IsString()
  @Matches(/^\d+$/)
  nonce!: string;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  messageHash!: string;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  signature!: string;
}

export class PreparePolymarketWalletTransferDto {
  @IsInt()
  @Min(1)
  amountMicroUsd!: number;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  recipientAddress!: string;
}

export class CompletePolymarketWalletTransferDto extends PreparePolymarketWalletTransferDto {
  @IsString()
  @Matches(/^\d+$/)
  nonce!: string;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  messageHash!: string;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  signature!: string;
}

export class PrepareDepositWalletTransferDto {
  @IsInt()
  @Min(1)
  amountMicroUsd!: number;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  recipientAddress!: string;
}

export class CompleteDepositWalletTransferDto extends PrepareDepositWalletTransferDto {
  @IsString()
  @Matches(/^\d+$/)
  nonce!: string;

  @IsString()
  @Matches(/^\d+$/)
  deadline!: string;

  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  signature!: string;
}
