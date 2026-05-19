import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { WalletProviders } from './wallet'
import '@rainbow-me/rainbowkit/styles.css'
import '@xyflow/react/dist/style.css'
import './index.css'

window.addEventListener('error', (event) => {
  if (event.message === 'ResizeObserver loop completed with undelivered notifications.') {
    event.stopImmediatePropagation()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProviders>
      <App />
    </WalletProviders>
  </StrictMode>,
)
