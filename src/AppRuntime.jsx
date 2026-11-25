import React, { useEffect, useState } from 'react'

export class RootErrorBoundary extends React.Component {
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
      return (
        <main style={{ minHeight: '100vh', boxSizing: 'border-box', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f8fc', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          <section style={{ width: '100%', maxWidth: '520px', padding: '28px', boxSizing: 'border-box', borderRadius: '22px', background: '#fff', boxShadow: '0 18px 55px rgba(15, 35, 70, 0.12)' }}>
            <div aria-hidden="true" style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', color: '#168fe5' }}>AEROINSTAL</div>
            <h1 style={{ margin: '8px 0 10px', color: '#12234f', fontSize: '24px' }}>Nie udało się uruchomić aplikacji</h1>
            <p style={{ color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
              Odśwież stronę. Jeśli problem będzie się powtarzał, skontaktuj się z administratorem.
            </p>
            <button type="button" onClick={() => window.location.reload()} style={{ width: '100%', marginTop: '8px', minHeight: '50px', border: 0, borderRadius: '14px', background: '#168fe5', color: '#fff', fontWeight: 800, fontSize: '16px' }}>
              Odśwież aplikację
            </button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

export function PwaUpdateBanner() {
  const [registration, setRegistration] = useState(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined

    let mounted = true
    const showWaiting = (nextRegistration) => {
      if (!mounted || !nextRegistration.waiting) return
      setRegistration(nextRegistration)
      setUpdateAvailable(true)
    }

    const register = async () => {
      try {
        const nextRegistration = await navigator.serviceWorker.register(
          '/sw.js?v=' + encodeURIComponent(import.meta.env.VITE_APP_VERSION),
          { updateViaCache: 'none' }
        )

        if (!mounted) return
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

    const handleControllerChange = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    if (document.readyState === 'complete') {
      void register()
    } else {
      window.addEventListener('load', register, { once: true })
    }

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
