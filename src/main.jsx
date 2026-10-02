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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update()
      })
      .catch((error) => {
        console.error('Nie udało się zarejestrować Service Workera:', error)
      })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
