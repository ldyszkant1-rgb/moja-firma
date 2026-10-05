import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Krytyczny błąd aplikacji:', error, info)
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error)
      return (
        <div style={{ minHeight: '100vh', boxSizing: 'border-box', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          <div style={{ width: '100%', maxWidth: '520px', padding: '28px', boxSizing: 'border-box', borderRadius: '22px', background: '#fff', boxShadow: '0 18px 55px rgba(15, 35, 70, 0.12)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', color: '#168fe5' }}>AEROINSTAL</div>
            <h1 style={{ margin: '8px 0 10px', color: '#12234f', fontSize: '24px' }}>Nie udało się uruchomić aplikacji</h1>
            <p style={{ color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>Wystąpił błąd podczas uruchamiania. Zamiast pustego ekranu pokazuję teraz dokładny komunikat.</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '12px', borderRadius: '12px', background: '#fff7f7', color: '#9b2c2c', fontSize: '12px', overflow: 'auto' }}>{message}</pre>
            <button type="button" onClick={() => window.location.reload()} style={{ width: '100%', marginTop: '16px', minHeight: '50px', border: 0, borderRadius: '14px', background: '#168fe5', color: '#fff', fontWeight: 800, fontSize: '16px' }}>Odśwież aplikację</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const APP_VERSION = '2026.10.05-7ed88e3'

function PwaUpdateBanner() {
  const [registration, setRegistration] = React.useState(null)
  const [updateAvailable, setUpdateAvailable] = React.useState(false)

  React.useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined

    let mounted = true
    let currentRegistration = null

    const showWaiting = (nextRegistration) => {
      if (!mounted) return
      currentRegistration = nextRegistration
      if (nextRegistration.waiting) {
        setRegistration(nextRegistration)
        setUpdateAvailable(true)
      }
    }

    const register = async () => {
      try {
        const nextRegistration = await navigator.serviceWorker.register(
          '/sw.js?v=' + encodeURIComponent(APP_VERSION),
          { updateViaCache: 'none' }
        )

        if (!mounted) return
        currentRegistration = nextRegistration
        showWaiting(nextRegistration)

        nextRegistration.addEventListener('updatefound', () => {
          const installing = nextRegistration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              showWaiting(nextRegistration)
            }
          })
        })

        await nextRegistration.update()
      } catch (error) {
        console.error('Nie udało się zarejestrować Service Workera:', error)
      }
    }

    const handleControllerChange = () => {
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    window.addEventListener('load', register, { once: true })

    return () => {
      mounted = false
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      window.removeEventListener('load', register)
    }
  }, [])

  if (!updateAvailable || !registration) return null

  const refresh = () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    setUpdateAvailable(false)
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '14px',
        right: '14px',
        bottom: 'calc(env(safe-area-inset-bottom) + 78px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 14px',
        border: '1px solid #cfe8fa',
        borderRadius: '16px',
        background: '#ffffff',
        boxShadow: '0 12px 30px rgba(15, 35, 70, 0.18)',
      }}
    >
      <span style={{ color: '#12234f', fontSize: '13px', fontWeight: 700 }}>
        Dostępna nowa wersja aplikacji
      </span>
      <button
        type="button"
        onClick={refresh}
        style={{
          flex: '0 0 auto',
          minHeight: '38px',
          padding: '0 13px',
          border: 0,
          borderRadius: '11px',
          background: '#0787e8',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 800,
        }}
      >
        Odśwież
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
      <PwaUpdateBanner />
    </RootErrorBoundary>
  </StrictMode>,
)
