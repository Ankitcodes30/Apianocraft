import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { pushError } from './utils/ErrorBus'
import { registerSW } from 'virtual:pwa-register'
import './styles/index.css'

registerSW({ immediate: true })

window.addEventListener('error', (ev) => {
  pushError('error', ev.message || 'Unknown script error')
})

window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason
  pushError('error', reason instanceof Error ? reason.message : String(reason))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
