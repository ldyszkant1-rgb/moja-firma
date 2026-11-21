import React, { useState } from 'react'
import { supabase } from './lib/supabase'

export default function AccountPasswordSettings() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 12) {
      setError('Hasło musi mieć co najmniej 12 znaków.')
      return
    }
    if (password !== confirmation) {
      setError('Podane hasła są różne.')
      return
    }

    setSaving(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user || user.is_anonymous || !user.email) {
        throw new Error('Aby zmienić hasło, zaloguj się na konto e-mail.')
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setPassword('')
      setConfirmation('')
      setOpen(false)
      setMessage('Hasło zostało zapisane. Przy następnym logowaniu użyj nowego hasła.')
    } catch (updateError) {
      console.error('Nie udało się zmienić hasła:', updateError)
      setError(
        updateError?.message?.toLowerCase().includes('reauth')
          ? 'Supabase wymaga ponownego potwierdzenia tożsamości. Nie wylogowuj się; skontaktuj się z administratorem.'
          : updateError?.message || 'Nie udało się zapisać hasła. Spróbuj ponownie.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="detail-card settings-detail-card" style={{ marginTop: 12 }}>
      <button
        type="button"
        className="settings-item settings-section-row"
        style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
        aria-expanded={open}
        onClick={() => { setOpen(!open); setError(''); setMessage('') }}
      >
        <span>🔑 Ustaw / zmień hasło</span>
        <span>{open ? '⌄' : '›'}</span>
      </button>

      {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}
      {open && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12, paddingTop: 12 }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            Ustaw hasło do swojego konta e-mail. Nie udostępniaj go innym osobom.
          </p>
          <label style={{ display: 'grid', gap: 6 }}>
            Nowe hasło (minimum 12 znaków)
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ padding: 12, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Powtórz nowe hasło
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              style={{ padding: 12, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </label>
          {error && <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
          <button className="save-button" type="submit" disabled={saving}>
            {saving ? 'Zapisywanie…' : 'Zapisz hasło'}
          </button>
        </form>
      )}
    </section>
  )
}
