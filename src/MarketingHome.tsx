import { useEffect } from 'react'

function MarketingHome() {
  useEffect(() => {
    document.title = 'Causeway | Prediction Market Infrastructure'
  }, [])

  return (
    <iframe
      aria-label="Causeway marketing home"
      src="/marketing/index.html"
      style={{
        width: '100vw',
        height: '100vh',
        border: 0,
        display: 'block',
        background: '#fbfdff',
      }}
      title="Causeway marketing home"
    />
  )
}

export default MarketingHome
