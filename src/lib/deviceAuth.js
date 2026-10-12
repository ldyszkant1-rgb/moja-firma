import { supabase } from './supabase'

export const DEVICE_USERS = ['Łukasz', 'Paweł']

const DEVICE_ID_KEYS = ['moja_firma_device_id', 'aeroinstal_device_id']
const DEVICE_USER_KEYS = ['moja_firma_device_user', 'aeroinstal_device_user']

function getStorageValue(keys) {
  if (typeof window === 'undefined') return null
  for (const key of keys) {
    try {
      const value = window.localStorage.getItem(key)
      if (value) return value
    } catch {}
  }
  return null
}

function setStorageValue(keys, value) {
  if (typeof window === 'undefined') return
  for (const key of keys) {
    try {
      window.localStorage.setItem(key, value)
    } catch {}
  }
}

export function getOrCreateDeviceId() {
  const existingId = getStorageValue(DEVICE_ID_KEYS)
  if (existingId) {
    setStorageValue(DEVICE_ID_KEYS, existingId)
    return existingId
  }

  const newId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'device-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12)

  setStorageValue(DEVICE_ID_KEYS, newId)
  return newId
}

export function getLocalDeviceUser() {
  const user = getStorageValue(DEVICE_USER_KEYS)
  return DEVICE_USERS.includes(user) ? user : null
}

export function saveLocalDeviceUser(user) {
  if (!DEVICE_USERS.includes(user)) return
  setStorageValue(DEVICE_USER_KEYS, user)
}

export function isAnonymousSession(session) {
  return Boolean(session?.user?.is_anonymous)
}

// Współdzielimy tworzenie sesji między wszystkimi wywołaniami. Na iOS kilka
// efektów/ponowień mogło jednocześnie zobaczyć brak sesji i utworzyć różne konta.
let anonymousSessionPromise = null
const deviceClaimPromises = new Map()

export function ensureLegacyAnonymousSession() {
  if (anonymousSessionPromise) return anonymousSessionPromise

  anonymousSessionPromise = (async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    if (sessionData?.session) {
      if (!isAnonymousSession(sessionData.session)) {
        throw new Error('Na tym urządzeniu jest aktywne konto firmowe. Wyloguj je przed użyciem trybu Aeroinstal.')
      }
      return sessionData.session
    }

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    if (!data?.session) {
      throw new Error('Supabase nie zwrócił sesji urządzenia.')
    }

    return data.session
  })()

  return anonymousSessionPromise.finally(() => {
    anonymousSessionPromise = null
  })
}

export async function claimDeviceInSupabase(deviceId, user) {
  if (!deviceId) throw new Error('Brak identyfikatora urządzenia.')
  if (!DEVICE_USERS.includes(user)) throw new Error('Nieprawidłowy użytkownik urządzenia.')

  const claimKey = `${deviceId}:${user}`
  if (deviceClaimPromises.has(claimKey)) return deviceClaimPromises.get(claimKey)

  const claimPromise = (async () => {
    await ensureLegacyAnonymousSession()

    const { data, error } = await supabase.rpc('claim_legacy_device', {
      p_device_id: deviceId,
      p_user_name: user,
    })

    if (error) throw error
    if (!DEVICE_USERS.includes(data)) {
      throw new Error('Nieprawidłowe przypisanie użytkownika urządzenia.')
    }
    return data
  })()

  deviceClaimPromises.set(claimKey, claimPromise)
  try {
    return await claimPromise
  } finally {
    if (deviceClaimPromises.get(claimKey) === claimPromise) {
      deviceClaimPromises.delete(claimKey)
    }
  }
}
