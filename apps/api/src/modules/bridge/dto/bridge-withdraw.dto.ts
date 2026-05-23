import { IsString, Length, Matches } from 'class-validator';

const CHAIN_ID_PATTERN = /^[0-9]{1,24}$/;
const TOKEN_ADDRESS_PATTERN = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{20,64})$/;

export class BridgeWithdrawDto {
  @IsString()
  @Matches(CHAIN_ID_PATTERN)
  toChainId!: string;

  @IsString()
  @Matches(TOKEN_ADDRESS_PATTERN)
  toTokenAddress!: string;

  @IsString()
  @Length(20, 128)
  recipientAddr!: string;
}
