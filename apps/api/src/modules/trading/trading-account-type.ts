import { IsIn, IsOptional } from 'class-validator';

export const TRADING_ACCOUNT_TYPES = ['auto', 'gnosis_safe', 'proxy', 'deposit_wallet'] as const;
export const CONCRETE_TRADING_ACCOUNT_TYPES = ['gnosis_safe', 'proxy', 'deposit_wallet'] as const;

export type TradingAccountType = typeof TRADING_ACCOUNT_TYPES[number];
export type ConcreteTradingAccountType = typeof CONCRETE_TRADING_ACCOUNT_TYPES[number];

export class TradingAccountTypeDto {
  @IsOptional()
  @IsIn(TRADING_ACCOUNT_TYPES)
  tradingAccountType?: TradingAccountType;
}

export function normalizeTradingAccountType(value: string | null | undefined): TradingAccountType {
  return TRADING_ACCOUNT_TYPES.includes(value as TradingAccountType) ? value as TradingAccountType : 'auto';
}
