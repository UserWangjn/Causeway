import { defineChain } from 'viem'
import { polygon } from 'wagmi/chains'

export const supportedChain = polygon

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network'],
    },
    public: {
      http: [import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
})

export const walletChains = [supportedChain, arcTestnet] as const
