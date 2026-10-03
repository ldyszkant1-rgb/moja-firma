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

export async function getDeviceUserFromSupabase(deviceId) {
  if (!deviceId) return null

  const { data, error } = await supabase
    .from('device_users')
    .select('user_name')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error) throw error
  return DEVICE_USERS.includes(data?.user_name) ? data.user_name : null
}

export async function claimDeviceInSupabase(deviceId, user) {
  if (!deviceId) throw new Error('Brak identyfikatora urządzenia.')
  if (!DEVICE_USERS.includes(user)) throw new Error('Nieprawidłowy użytkownik urządzenia.')

  const { data: existing, error: readError } = await supabase
    .from('device_users')
    .select('user_name')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (readError) throw readError

  if (existing?.user_name) {
    if (!DEVICE_USERS.includes(existing.user_name)) {
      throw new Error('Urządzenie ma nieprawidłowe przypisanie.')
    }
    if (existing.user_name !== user) {
      throw new Error('To urządzenie jest już przypisane do innego użytkownika.')
    }
    return existing.user_name
  }

  const { data, error } = await supabase
    .from('device_users')
    .upsert({ device_id: deviceId, user_name: user }, { onConflict: 'device_id' })
    .select('user_name')
    .single()

  if (error) throw error
  return data?.user_name || user
}
