import React, { useEffect, useMemo, useState } from 'react'
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

export default function AuthPage({ session = null }) {
  const [invitationId, setInvitationId] = useState(session?.user?.user_metadata?.invitation_id || null)
  const [pendingInvitations, setPendingInvitations] = useState([])
  const invitedEmail = session?.user?.email || ''
  const hasInvitation = Boolean(invitationId)

  const [mode, setMode] = useState(session ? (hasInvitation ? 'accept' : 'setup') : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState(session?.user?.user_metadata?.display_name || '')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!session) return

    setEmail(session.user?.email || '')
    setDisplayName(session.user?.user_metadata?.display_name || session.user?.email?.split('@')[0] || '')

    const metadataInvitationId = session.user?.user_metadata?.invitation_id || null
    if (metadataInvitationId) {
      setInvitationId(metadataInvitationId)
      setMode('accept')
      return () => { cancelled = true }
    }

    supabase.functions.invoke('organization-invitations', {
      body: { action: 'list-my-invitations' },
    }).then(({ data, error }) => {
      if (cancelled) return
      if (error || data?.error) {
        setMode('setup')
        return
      }
      const invites = Array.isArray(data?.invitations) ? data.invitations : []
      setPendingInvitations(invites)
      if (invites.length) {
        setInvitationId(invites[0].id)
        setMode('accept')
      } else {
        setMode('setup')
      }
    }).catch(() => {
      if (!cancelled) setMode('setup')
    })

    return () => { cancelled = true }
  }, [session])

  const title = useMemo(() => {
    if (mode === 'login') return 'Zaloguj się'
    if (mode === 'accept') return 'Dołącz do firmy'
    if (mode === 'setup') return 'Utwórz swoją firmę'
    return 'Utwórz swoje konto'
  }, [mode])

  const subtitle = useMemo(() => {
    if (mode === 'login') return 'Zaloguj się do swojej przestrzeni firmy.'
    if (mode === 'accept') return 'Otrzymałeś zaproszenie. Po akceptacji uzyskasz dostęp do przestrzeni tej firmy.'
    if (mode === 'setup') return 'Konto jest gotowe. Podaj nazwę firmy, aby utworzyć swoją przestrzeń.'
    return 'Załóż konto, utwórz firmę i później dodawaj swoich pracowników.'
  }, [mode])

  const resetMessages = () => {
    setMessage('')
    setError('')
  }

  const handlePasswordReset = async () => {
    resetMessages()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Najpierw podaj adres e-mail.')
      return
    }
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      })
      if (resetError) throw resetError
      setResetSent(true)
      setMessage('Jeśli konto istnieje, wysłaliśmy instrukcję zmiany hasła na podany adres e-mail.')
    } catch (resetError) {
      console.error('Błąd resetu hasła:', resetError)
      setError('Nie udało się wysłać instrukcji zmiany hasła. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    resetMessages()

    const cleanEmail = email.trim().toLowerCase()
    const cleanCompany = companyName.trim()
    const cleanDisplayName = displayName.trim()

    if (mode === 'accept') {
      setLoading(true)
      try {
        const { data, error: acceptError } = await supabase.functions.invoke('organization-invitations', {
          body: {
            action: 'accept',
            invitationId,
          },
        })
        if (acceptError) throw acceptError
        if (data?.error) throw new Error(data.error)
        window.location.reload()
      } catch (submitError) {
        console.error('Błąd akceptacji zaproszenia:', submitError)
        setError(submitError?.message || 'Nie udało się zaakceptować zaproszenia.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'setup' && session) {
      if (!cleanCompany) {
        setError('Podaj nazwę swojej firmy.')
        return
      }

      setLoading(true)
      try {
        const { data: organizationData, error: organizationError } = await supabase.functions.invoke('organization-invitations', {
          body: { action: 'create-company', name: cleanCompany, displayName: cleanDisplayName || cleanEmail.split('@')[0] },
        })
        if (organizationError) throw organizationError
        if (organizationData?.error) throw new Error(organizationData.error)
        window.location.reload()
      } catch (submitError) {
        console.error('Błąd tworzenia firmy:', submitError)
        const code = submitError?.code || ''
        setError(code === 'ORGANIZATION_SLUG_TAKEN'
          ? 'Taka nazwa firmy jest już zajęta. Wybierz inną nazwę.'
          : submitError?.message || 'Nie udało się utworzyć firmy.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!cleanEmail || !password) {
      setError('Podaj adres e-mail i hasło.')
      return
    }

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.')
      return
    }

    if (mode === 'register' && !cleanCompany) {
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
        setMessage('Konto zostało utworzone. Sprawdź skrzynkę e-mail i potwierdź adres. Następnie zaloguj się do aplikacji.')
        setMode('login')
        return
      }

      const { data: organizationData, error: organizationError } = await supabase.functions.invoke('organization-invitations', {
        body: { action: 'create-company', name: cleanCompany, displayName: cleanDisplayName || cleanEmail.split('@')[0] },
      })
      if (organizationError) throw organizationError
      if (organizationData?.error) throw new Error(organizationData.error)

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

  const showAccountFields = mode === 'login' || mode === 'register'
  const showCompanyFields = mode === 'register' || mode === 'setup'

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={{ marginBottom: '26px' }}>
          <div style={badgeStyle}>MOJA FIRMA</div>
          <h1 style={titleStyle}>{title}</h1>
          <p style={{ margin: 0, color: '#68758a', lineHeight: 1.5 }}>{subtitle}</p>
        </div>

        {mode === 'accept' && (
          <div style={inviteBoxStyle}>
            <strong>Zaproszenie do firmy</strong>
            <div style={{ marginTop: 6, color: '#53647b' }}>
              {pendingInvitations.find((invite) => invite.id === invitationId)?.organization_name
                ? <>Zaproszenie do <strong>{pendingInvitations.find((invite) => invite.id === invitationId).organization_name}</strong>.</>
                : <>Zaproszenie zostało wysłane na <strong>{invitedEmail}</strong>.</>}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          {showCompanyFields && (
            <>
              <label style={labelStyle}>
                <strong style={labelTextStyle}>Twoje imię</strong>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="np. Łukasz"
                  autoComplete="name"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                <strong style={labelTextStyle}>Nazwa firmy</strong>
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

          {showAccountFields && (
            <>
              <label style={labelStyle}>
                <strong style={labelTextStyle}>E-mail</strong>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ty@firma.pl"
                  autoComplete="email"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                <strong style={labelTextStyle}>Hasło</strong>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 znaków"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={inputStyle}
                />
              </label>
            </>
          )}

          {error && <div style={errorStyle}>{error}</div>}
          {message && <div style={messageStyle}>{message}</div>}

          {mode === 'login' && (
            <button type="button" onClick={handlePasswordReset} disabled={loading} style={forgotStyle}>
              Nie pamiętam hasła
            </button>
          )}

          <button type="submit" disabled={loading} style={{ ...submitStyle, opacity: loading ? 0.65 : 1 }}>
            {loading
              ? 'Przetwarzanie…'
              : mode === 'login'
                ? 'Zaloguj się'
                : mode === 'accept'
                  ? 'Dołącz do firmy'
                  : mode === 'setup'
                    ? 'Utwórz firmę'
                    : 'Utwórz konto i firmę'}
          </button>
        </form>

        {mode !== 'setup' && mode !== 'accept' && (
          <div style={toggleStyle}>
            <button
              type="button"
              onClick={() => {
                resetMessages()
                setMode((current) => (current === 'login' ? 'register' : 'login'))
              }}
              style={toggleButtonStyle}
            >
              {mode === 'login' ? 'Nie masz konta? Utwórz firmę' : 'Masz już konto? Zaloguj się'}
            </button>
          </div>
        )}

        {mode === 'setup' && (
          <div style={hintStyle}>
            To konto nie ma jeszcze firmy. Po utworzeniu zostaniesz jej właścicielem.
          </div>
        )}
      </section>
    </main>
  )
}

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  boxSizing: 'border-box',
  background: 'linear-gradient(180deg, #f5f9fd 0%, #eef4fa 100%)',
}

const cardStyle = {
  width: '100%',
  maxWidth: '460px',
  background: '#ffffff',
  border: '1px solid rgba(15, 48, 90, 0.08)',
  borderRadius: '28px',
  padding: '30px',
  boxSizing: 'border-box',
  boxShadow: '0 24px 70px rgba(18, 35, 79, 0.12)',
}

const badgeStyle = {
  display: 'inline-flex',
  padding: '8px 12px',
  borderRadius: '999px',
  background: '#eaf5ff',
  color: '#087fce',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
}

const titleStyle = {
  margin: '16px 0 8px',
  color: '#12234f',
  fontSize: '30px',
  lineHeight: 1.15,
}

const labelStyle = {
  display: 'grid',
  gap: '6px',
}

const labelTextStyle = {
  color: '#243451',
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

const submitStyle = {
  minHeight: '52px',
  marginTop: '4px',
  border: 'none',
  borderRadius: '15px',
  background: '#168fe5',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 800,
  cursor: 'pointer',
}

const errorStyle = {
  padding: '12px 14px',
  borderRadius: '14px',
  background: '#fff4f4',
  color: '#b52d3a',
  border: '1px solid #f1c8cd',
  lineHeight: 1.45,
}

const messageStyle = {
  padding: '12px 14px',
  borderRadius: '14px',
  background: '#effaf4',
  color: '#177447',
  border: '1px solid #c8ead6',
  lineHeight: 1.45,
}

const inviteBoxStyle = {
  padding: '14px 16px',
  borderRadius: '16px',
  background: '#eef7ff',
  border: '1px solid #cfe6f8',
  color: '#243451',
  marginBottom: '16px',
  lineHeight: 1.45,
}


const forgotStyle = {
  border: 'none',
  background: 'transparent',
  color: '#68758a',
  fontWeight: 700,
  cursor: 'pointer',
  padding: '4px 0',
  textAlign: 'left',
}

const toggleStyle = {
  display: 'flex',
  justifyContent: 'center',
  marginTop: '18px',
  paddingTop: '18px',
  borderTop: '1px solid #e8eef5',
}

const toggleButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: '#087fce',
  fontWeight: 800,
  cursor: 'pointer',
  padding: '8px',
}

const hintStyle = {
  marginTop: '16px',
  padding: '12px 14px',
  borderRadius: '14px',
  background: '#f7f9fc',
  color: '#68758a',
  fontSize: '13px',
  lineHeight: 1.45,
}
