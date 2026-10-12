import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const api = readFileSync('src/lib/jobsApi.js', 'utf8')
const app = readFileSync('src/App.jsx', 'utf8')
const migration = readFileSync('supabase/migrations/20261012190000_harden_storage_access_by_organization.sql', 'utf8')

assert.match(api, /\.createSignedUrl\(path, SIGNED_URL_TTL_SECONDS\)/, 'Storage URLs must be signed')
assert.doesNotMatch(api, /getPublicUrl\s*\(/, 'Client code must not generate public URLs')
assert.match(api, /function sanitizeStorageFile\(/, 'Storage metadata must be sanitized')
assert.match(api, /delete metadata\\.url/, 'URLs must be removed before persisting file metadata')
assert.match(api, /delete metadata\\.path/, 'Untrusted paths must be removed before persisting file metadata')
assert.match(api, /storageMetadata\.documents/, 'Document metadata must be sanitized before writes')
assert.match(api, /storageMetadata\.photos/, 'Gallery metadata must be sanitized before writes')
assert.match(api, /storageMetadata\.main_photo/, 'Main-photo metadata must be sanitized before writes')
assert.match(api, /export async function refreshSupabaseFileUrl\(/, 'Expired URLs must be refreshable')
assert.match(app, /async function openSignedStorageFile\(/, 'Opening a file must request a fresh signed URL')
assert.match(app, /onError=\{async \(event\)/, 'Images must retry after signed URL errors')

for (const command of ['insert', 'update', 'delete', 'select']) {
  assert.match(migration, new RegExp('for ' + command, 'i'), 'Missing Storage ' + command.toUpperCase() + ' policy')
}
assert.match(migration, /\(storage\.foldername\(name\)\)\[2\]/, 'Policies must use the requested object name')
assert.match(migration, /j\.organization_id = private\.current_organization_id\(\)/, 'Policies must scope access to the active organization')
assert.doesNotMatch(migration, /UPDATE\s+storage\.buckets/i, 'Bucket visibility must be a separate post-deploy step')

console.log('Storage security contract checks passed.')
