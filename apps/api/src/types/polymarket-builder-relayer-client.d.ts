declare module '@polymarket/builder-relayer-client/dist/builder' {
  export function deriveDepositWallet(owner: string, factory: string, implementation: string): string;

  export function buildDepositWalletCreateRequest(
    from: string,
    config: {
      DepositWalletFactory: string;
      DepositWalletImplementation: string;
    },
  ): unknown;
}

declare module '@polymarket/builder-relayer-client/dist/config' {
  export interface ContractConfig {
    ProxyContracts: {
      RelayHub: string;
      ProxyFactory: string;
    };
    SafeContracts: {
      SafeFactory: string;
      SafeMultisend: string;
    };
    DepositWalletContracts: {
      DepositWalletFactory: string;
      DepositWalletImplementation: string;
    };
  }

  export function getContractConfig(chainId: number): ContractConfig;
}
