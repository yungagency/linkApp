import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SessionProvider } from './lib/session'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)

// PWA : service worker (hors Capacitor, où l'app est déjà locale)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !('Capacitor' in window)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}
