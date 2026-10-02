import React, { useState } from 'react'
import { supabase } from './lib/supabase'

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const resetMessages = () => {
    setMessage('')
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    resetMessages()

    const cleanEmail = email.trim().toLowerCase()
    const cleanCompany = companyName.trim()
    const cleanDisplayName = displayName.trim()

    if (!cleanEmail || !password) {
      setError('Podaj adres e-mail i hasło.')
      return
    }

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.')
      return
    }

    if ((mode === 'register' || mode === 'setup') && !cleanCompany) {
      setError('Podaj nazwę swojej firmy.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (signInError) throw signInError

        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('organization_id')
          .limit(1)

        if (membershipError) throw membershipError

        if (!membership?.length) {
          setMessage('Konto jest aktywne. Dokończ teraz tworzenie swojej firmy.')
          setMode('setup')
          return
        }

        window.location.reload()
        return
      }

      if (mode === 'setup') {
        const { error: organizationError } = await supabase.rpc('create_organization', {
          p_name: cleanCompany,
          p_slug: slugify(cleanCompany),
          p_display_name: cleanDisplayName || cleanEmail.split('@')[0],
        })

        if (organizationError) throw organizationError

        window.location.reload()
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanDisplayName || cleanEmail.split('@')[0],
          },
        },
      })

      if (signUpError) throw signUpError

      if (!data.session) {
        setMessage(
          'Konto zostało utworzone. Sprawdź skrzynkę e-mail i potwierdź adres. Następnie zaloguj się do aplikacji.'
        )
        setMode('login')
        return
      }

      const { error: organizationError } = await supabase.rpc('create_organization', {
        p_name: cleanCompany,
        p_slug: slugify(cleanCompany),
        p_display_name: cleanDisplayName || cleanEmail.split('@')[0],
      })

      if (organizationError) throw organizationError

      window.location.reload()
    } catch (submitError) {
      console.error('Błąd logowania/rejestracji:', submitError)

      const code = submitError?.code || ''
      if (code === 'invalid_credentials') {
        setError('Nieprawidłowy e-mail lub hasło.')
      } else if (code === 'email_exists') {
        setError('Konto z tym adresem e-mail już istnieje. Zaloguj się.')
      } else if (code === 'ORGANIZATION_SLUG_TAKEN') {
        setError('Taka nazwa firmy jest już zajęta. Wybierz inną nazwę.')
      } else if (code === 'USER_ALREADY_HAS_ORGANIZATION') {
        setError('To konto ma już przypisaną firmę.')
      } else {
        setError(submitError?.message || 'Nie udało się wykonać operacji. Spróbuj ponownie.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        background: 'linear-gradient(180deg, #f5f9fd 0%, #eef4fa 100%)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          border: '1px solid rgba(15, 48, 90, 0.08)',
          borderRadius: '28px',
          padding: '30px',
          boxSizing: 'border-box',
          boxShadow: '0 24px 70px rgba(18, 35, 79, 0.12)',
        }}
      >
        <div style={{ marginBottom: '26px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '8px 12px',
              borderRadius: '999px',
              background: '#eaf5ff',
              color: '#087fce',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.08em',
            }}
          >
            MOJA FIRMA
          </div>
          <h1
            style={{
              margin: '16px 0 8px',
              color: '#12234f',
              fontSize: '30px',
              lineHeight: 1.15,
            }}
          >
            {mode === 'login' ? 'Zaloguj się' : mode === 'setup' ? 'Dokończ konfigurację' : 'Utwórz swoją firmę'}
          </h1>
          <p style={{ margin: 0, color: '#68758a', lineHeight: 1.5 }}>
            {mode === 'login'
              ? 'Zaloguj się do swojej przestrzeni firmy.'
              : mode === 'setup'
                ? 'Konto jest gotowe. Podaj nazwę firmy, aby utworzyć swoją przestrzeń.'
                : 'Załóż konto, utwórz firmę i później dodawaj swoich pracowników.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          {(mode === 'register' || mode === 'setup') && (
            <>
              <label style={{ display: 'grid', gap: '6px' }}>
                <strong style={{ color: '#243451' }}>Twoje imię</strong>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="np. Łukasz"
                  autoComplete="name"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px' }}>
                <strong style={{ color: '#243451' }}>Nazwa firmy</strong>
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="np. Moja Firma Sp. z o.o."
                  autoComplete="organization"
                  style={inputStyle}
                />
              </label>
            </>
          )}

          <label style={{ display: 'grid', gap: '6px' }}>
            <strong style={{ color: '#243451' }}>E-mail</strong>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ty@firma.pl"
              autoComplete="email"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '6px' }}>
            <strong style={{ color: '#243451' }}>Hasło</strong>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 znaków"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={inputStyle}
            />
          </label>

          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                background: '#fff4f4',
                color: '#b52d3a',
                border: '1px solid #f1c8cd',
                lineHeight: 1.45,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                background: '#effaf4',
                color: '#177447',
                border: '1px solid #c8ead6',
                lineHeight: 1.45,
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              minHeight: '52px',
              marginTop: '4px',
              border: 'none',
              borderRadius: '15px',
              background: loading ? '#8ebfe3' : '#168fe5',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading
              ? 'Przetwarzanie…'
              : mode === 'login'
                ? 'Zaloguj się'
                : mode === 'setup'
                  ? 'Utwórz firmę'
                  : 'Utwórz konto i firmę'}
          </button>
        </form>

        {mode !== 'setup' && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '18px',
              paddingTop: '18px',
              borderTop: '1px solid #e8eef5',
            }}
          >
            <button
              type="button"
              onClick={() => {
                resetMessages()
                setMode((current) => (current === 'login' ? 'register' : 'login'))
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#087fce',
                fontWeight: 800,
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              {mode === 'login'
                ? 'Nie masz konta? Utwórz firmę'
                : 'Masz już konto? Zaloguj się'}
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

const inputStyle = {
  width: '100%',
  minHeight: '50px',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid #d7e1eb',
  background: '#f8fbfe',
  color: '#12234f',
  fontSize: '16px',
  outline: 'none',
}
