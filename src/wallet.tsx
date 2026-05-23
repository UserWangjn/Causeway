import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { supportedChain, walletChains } from './wallet-config'

const queryClient = new QueryClient()

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'causeway-local-dev'

const wagmiConfig = getDefaultConfig({
  appName: 'Causeway',
  projectId: walletConnectProjectId,
  chains: walletChains,
  ssr: false,
})

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={supportedChain} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
