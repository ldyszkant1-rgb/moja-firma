import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isSafeStoragePath,
  pathFromLegacyPublicUrl,
  sanitizeStorageFile,
  sanitizeJobStorageMetadata,
} from '../src/lib/storageSecurity.js'

const SUPABASE_URL = 'https://project-ref.supabase.co'
const BUCKET = 'aeroinstal-files'
const validPath = 'jobs/123/main-photo/cover.jpg'
const validLegacyUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${validPath}`

// Test rzeczywistej logiki walidacji ścieżek.
assert.equal(isSafeStoragePath(validPath, 123), true, 'A valid path for the matching job must pass')
assert.equal(isSafeStoragePath(validPath, 456), false, 'A path belonging to another job must fail')
assert.equal(isSafeStoragePath('../123/main-photo/a.jpg', 123), false, 'Traversal must fail')
assert.equal(isSafeStoragePath('jobs/123/../secret/a.jpg', 123), false, 'Traversal in the middle must fail')
assert.equal(isSafeStoragePath('jobs/123/main-photo\\a.jpg', 123), false, 'Backslash paths must fail')
assert.equal(isSafeStoragePath('jobs/123//a.jpg', 123), false, 'Empty path segments must fail')
assert.equal(isSafeStoragePath('jobs/123/a.jpg', 123), false, 'Paths must contain a folder and filename')

assert.equal(pathFromLegacyPublicUrl(validLegacyUrl, 123, SUPABASE_URL, BUCKET), validPath)
assert.equal(pathFromLegacyPublicUrl(validLegacyUrl, 456, SUPABASE_URL, BUCKET), null, 'Legacy URL for another job must fail')
assert.equal(pathFromLegacyPublicUrl(validLegacyUrl.replace('project-ref.supabase.co', 'attacker.example'), 123, SUPABASE_URL, BUCKET), null, 'Foreign origins must fail')
assert.equal(pathFromLegacyPublicUrl(validLegacyUrl.replace(BUCKET, 'another-bucket'), 123, SUPABASE_URL, BUCKET), null, 'Wrong bucket must fail')
assert.equal(pathFromLegacyPublicUrl('not a URL', 123, SUPABASE_URL, BUCKET), null, 'Malformed URLs must fail')
assert.equal(pathFromLegacyPublicUrl(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/jobs/123/%2E%2E/secret/file.jpg`, 123, SUPABASE_URL, BUCKET), null, 'Encoded traversal must fail')

const safeFile = sanitizeStorageFile({ name: 'photo.jpg', path: validPath, url: 'https://expired.example/file', type: 'image/jpeg' }, 123, SUPABASE_URL, BUCKET)
assert.deepEqual(safeFile, { name: 'photo.jpg', type: 'image/jpeg', path: validPath }, 'Valid metadata must retain its safe path but drop URLs')

const legacyFile = sanitizeStorageFile({ name: 'legacy.pdf', url: validLegacyUrl, size: 100 }, 123, SUPABASE_URL, BUCKET)
assert.deepEqual(legacyFile, { name: 'legacy.pdf', size: 100, path: validPath }, 'Trusted legacy URLs must migrate to safe paths')

const hostileFile = sanitizeStorageFile({ name: 'hostile.jpg', path: 'jobs/999/private/a.jpg', url: 'https://attacker.example/file' }, 123, SUPABASE_URL, BUCKET)
assert.deepEqual(hostileFile, { name: 'hostile.jpg' }, 'Untrusted path and URL must both be removed')

const metadata = sanitizeJobStorageMetadata({
  id: 123,
  documents: { material: { name: 'plan.pdf', url: validLegacyUrl } },
  photos: [{ name: 'photo.jpg', path: validPath, url: 'https://expired.example/file' }],
  mainPhoto: { name: 'cover.jpg', path: 'jobs/999/main/cover.jpg', url: 'https://attacker.example/file' },
}, SUPABASE_URL, BUCKET)
assert.deepEqual(metadata.documents.material, { name: 'plan.pdf', path: validPath })
assert.deepEqual(metadata.photos[0], { name: 'photo.jpg', path: validPath })
assert.deepEqual(metadata.main_photo, { name: 'cover.jpg' })
assert.deepEqual(sanitizeJobStorageMetadata({ id: 123 }, SUPABASE_URL, BUCKET), {
  documents: { material: null, assembly: null },
  photos: [],
  main_photo: null,
})

// Retain source-level checks for integration points and SQL policy intent.
const api = readFileSync('src/lib/jobsApi.js', 'utf8')
const app = readFileSync('src/App.jsx', 'utf8')
const migration = readFileSync('supabase/migrations/20261012190000_harden_storage_access_by_organization.sql', 'utf8')

assert.match(api, /\.createSignedUrl\(path, SIGNED_URL_TTL_SECONDS\)/, 'Storage URLs must be signed')
assert.doesNotMatch(api, /getPublicUrl\s*\(/, 'Client code must not generate public URLs')
assert.match(api, /sanitizeJobStorageMetadata\(job, SUPABASE_URL, STORAGE_BUCKET\)/, 'Job writes must sanitize Storage metadata')
assert.match(api, /export async function refreshSupabaseFileUrl\(/, 'Expired URLs must be refreshable')
assert.match(app, /async function openSignedStorageFile\(/, 'Opening a file must request a fresh signed URL')
assert.match(app, /onError=\{async \(event\)/, 'Images must retry after signed URL errors')

for (const command of ['insert', 'update', 'delete', 'select']) {
  assert.match(migration, new RegExp('for ' + command, 'i'), 'Missing Storage ' + command.toUpperCase() + ' policy')
}
assert.match(migration, /\(storage\.foldername\(storage\.objects\.name\)\)\[2\]/, 'Policies must qualify the Storage object name to avoid ambiguity with public.jobs.name')
assert.doesNotMatch(migration, /storage\.foldername\(name\)/, 'Policies must not use an ambiguous unqualified name')
assert.match(migration, /j\.organization_id = private\.current_organization_id\(\)/, 'Policies must scope access to the active organization')
assert.doesNotMatch(migration, /UPDATE\s+storage\.buckets/i, 'Bucket visibility must be a separate post-deploy step')


// File objects must not be deleted before their metadata update is persisted.
function sourceSection(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, 'Missing source section start: ' + start)
  assert.notEqual(endIndex, -1, 'Missing source section end: ' + end)
  return source.slice(startIndex, endIndex)
}

const addDocumentSection = sourceSection(app, 'const addDocument = async (', 'const removeDocument = async (')
assert.ok(addDocumentSection.indexOf('await onUpdate(') < addDocumentSection.indexOf('await deleteSupabaseFile(oldDocument.path)'), 'Old document must be deleted only after metadata save')
assert.ok(addDocumentSection.indexOf('if (saveResult === false) {') < addDocumentSection.indexOf('await deleteSupabaseFile(oldDocument.path)'), 'Old document must be retained when metadata save fails')

const removeDocumentSection = sourceSection(app, 'const removeDocument = async (', 'const renameDocument = async (')
assert.ok(removeDocumentSection.indexOf('await onUpdate(') < removeDocumentSection.indexOf('await deleteSupabaseFile('), 'Document metadata must be saved before deleting its Storage object')
assert.ok(removeDocumentSection.indexOf('if (saveResult === false) {') < removeDocumentSection.indexOf('await deleteSupabaseFile('), 'Document object must be retained when metadata save fails')

const addMainPhotoSection = sourceSection(app, 'const addMainPhoto = async (', 'const handleMainPhotoPaste = async (')
assert.ok(addMainPhotoSection.indexOf('await onUpdate(') < addMainPhotoSection.indexOf('await deleteSupabaseFile('), 'Old main photo must be deleted only after metadata save')
assert.ok(addMainPhotoSection.indexOf('if (saveResult === false) {') < addMainPhotoSection.indexOf('await deleteSupabaseFile('), 'Old main photo must be retained when metadata save fails')

const removeMainPhotoSection = sourceSection(app, 'const removeMainPhoto = async () => {', 'const addPhoto = async (')
assert.ok(removeMainPhotoSection.indexOf('await onUpdate(') < removeMainPhotoSection.indexOf('await deleteSupabaseFile('), 'Main-photo metadata must be saved before deleting its Storage object')
assert.ok(removeMainPhotoSection.indexOf('if (saveResult === false) {') < removeMainPhotoSection.indexOf('await deleteSupabaseFile('), 'Main-photo object must be retained when metadata save fails')

const addPhotoSection = sourceSection(app, 'const addPhoto = async (', 'const renamePhoto = async (')
assert.match(app, /async function cleanupUploadedStorageFile\(path\)/, 'Failed metadata writes must clean up orphaned uploads')
assert.match(addDocumentSection, /setEditedJob\(editedJob\)/, 'Failed document metadata writes must roll back local state')
assert.match(addDocumentSection, /cleanupUploadedStorageFile\(uploadedDocument\.path\)/, 'Failed document metadata writes must clean up the uploaded file')
assert.match(addMainPhotoSection, /setEditedJob\(editedJob\)/, 'Failed main-photo metadata writes must roll back local state')
assert.match(addMainPhotoSection, /cleanupUploadedStorageFile\(uploadedPhoto\.path\)/, 'Failed main-photo metadata writes must clean up the uploaded file')
assert.match(addPhotoSection, /uploadedPhotoPath = uploadedPhoto\.path/, 'Gallery upload path must be tracked until metadata is saved')
assert.match(addPhotoSection, /cleanupUploadedStorageFile\(uploadedPhotoPath\)/, 'Failed gallery metadata writes must clean up the uploaded file')
assert.match(removeDocumentSection, /setEditedJob\(editedJob\)/, 'Failed document removals must roll back local state')
assert.match(removeMainPhotoSection, /setEditedJob\(editedJob\)/, 'Failed main-photo removals must roll back local state')

console.log('Storage security unit and contract checks passed.')
