import { IsString, Length, Matches } from 'class-validator';

const CHAIN_ID_PATTERN = /^[0-9]{1,24}$/;
const TOKEN_ADDRESS_PATTERN = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{20,64})$/;
const BASE_UNIT_PATTERN = /^[0-9]{1,78}$/;

export class BridgeQuoteDto {
  @IsString()
  @Matches(BASE_UNIT_PATTERN)
  fromAmountBaseUnit!: string;

  @IsString()
  @Matches(CHAIN_ID_PATTERN)
  fromChainId!: string;

  @IsString()
  @Matches(TOKEN_ADDRESS_PATTERN)
  fromTokenAddress!: string;

  @IsString()
  @Length(20, 128)
  recipientAddress!: string;

  @IsString()
  @Matches(CHAIN_ID_PATTERN)
  toChainId!: string;

  @IsString()
  @Matches(TOKEN_ADDRESS_PATTERN)
  toTokenAddress!: string;
}
