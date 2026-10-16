import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.API_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

assert.ok(url && /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url), 'Refusing to run unless Supabase API is local')
assert.ok(serviceRoleKey, 'Missing local SERVICE_ROLE_KEY')

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await admin.storage.createBucket('aeroinstal-files', {
  public: true,
  fileSizeLimit: '50MB',
})

if (error) throw error
assert.equal(data.name, 'aeroinstal-files')
console.log('Created synthetic public bucket; the real private-bucket migration will be applied next.')
