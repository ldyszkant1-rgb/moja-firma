import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const jobsApi = readFileSync(new URL('../src/lib/jobsApi.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

function section(source, start, end) {
  const startIndex = source.indexOf(start)
  assert.notEqual(startIndex, -1, `Nie znaleziono początku sekcji: ${start}`)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(endIndex, -1, `Nie znaleziono końca sekcji: ${end}`)
  return source.slice(startIndex, endIndex)
}

test('upload akceptuje wyłącznie znane foldery realizacji', () => {
  const upload = section(jobsApi, 'export async function uploadSupabaseFile(', '/* =========================================================\n   USUWANIE PLIKU ZE STORAGE')
  assert.match(upload, /allowedFolders/)
  assert.match(upload, /'main'/)
  assert.match(upload, /'photos'/)
  assert.match(upload, /'documents\/material'/)
  assert.match(upload, /'documents\/assembly'/)
  assert.match(upload, /if \(!allowedFolders\.has\(folder\)\)/)
})

test('błąd tworzenia signed URL uruchamia sprzątanie uploadu', () => {
  const upload = section(jobsApi, 'export async function uploadSupabaseFile(', '/* =========================================================\n   USUWANIE PLIKU ZE STORAGE')
  const signedUrlError = upload.indexOf('if (signedUrlError)')
  const cleanup = upload.indexOf('await deleteSupabaseFile(path)', signedUrlError)
  const rethrow = upload.indexOf('throw signedUrlError', signedUrlError)
  assert.ok(signedUrlError >= 0, 'Obsługa błędu signed URL musi istnieć')
  assert.ok(cleanup > signedUrlError, 'Plik powinien być sprzątany po błędzie signed URL')
  assert.ok(rethrow > cleanup, 'Po sprzątaniu musi zostać zgłoszony pierwotny błąd')
})

test('błąd zapisu metadanych galerii sprząta nowy plik', () => {
  const photo = section(app, 'const addPhoto = async (', 'const renamePhoto = async (')
  assert.match(photo, /await appendSupabaseJobPhoto\(/)
  assert.match(photo, /if \(uploadedPhoto\?\.path\)/)
  assert.match(photo, /await deleteSupabaseFile\(uploadedPhoto\.path\)/)
})

test('zdjęcie główne nie usuwa starego pliku przed zapisem nowych metadanych', () => {
  const add = section(app, 'const addMainPhoto = async (', 'const handleMainPhotoPaste = async')
  assert.ok(add.indexOf('await onUpdate(updatedJob)') < add.indexOf('await deleteSupabaseFile(oldMainPhoto.path)'))
  assert.match(add, /if \(saved === false\)/)
  assert.match(add, /await deleteSupabaseFile\(uploadedPhoto\.path\)/)
})

test('usunięcie zdjęcia głównego zapisuje metadane przed usunięciem pliku', () => {
  const remove = section(app, 'const removeMainPhoto = async (', 'const addPhoto = async (')
  assert.ok(remove.indexOf('await onUpdate(updatedJob)') < remove.indexOf('await deleteSupabaseFile(mainPhoto.path)'))
  assert.match(remove, /if \(saved === false\)/)
})

test('podmiana dokumentu zachowuje poprzedni plik do czasu zapisu metadanych', () => {
  const add = section(app, 'const addDocument = async (', 'const removeDocument = async (')
  assert.ok(add.indexOf('await onUpdate(updatedJob)') < add.indexOf('await deleteSupabaseFile(oldDocument.path)'))
  assert.match(add, /if \(saved === false\)/)
  assert.match(add, /await deleteSupabaseFile\(uploadedDocument.path\)/)
})

test('usunięcie dokumentu zapisuje metadane przed usunięciem pliku', () => {
  const remove = section(app, 'const removeDocument = async (', 'const renameDocument = async (')
  assert.ok(remove.indexOf('await onUpdate(updatedJob)') < remove.indexOf('await deleteSupabaseFile(document.path)'))
  assert.match(remove, /if \(saved === false\)/)
})

test('RPC galerii waliduje typ payloadu, identyfikator i ścieżkę przypisaną do realizacji', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261015140000_validate_job_photo_rpc_payloads.sql', import.meta.url), 'utf8')
  assert.match(migration, /jsonb_typeof\(p_photo\) is distinct from 'object'/)
  assert.match(migration, /length\(v_photo_id\) > 128/)
  assert.match(migration, /length\(v_photo_name\) > 255/)
  assert.match(migration, /\^jobs\//)
  assert.match(migration, /\/photos\/\[\^\/\]\+\$/)
  assert.match(migration, /jsonb_typeof\(p_photo->'size'\) is distinct from 'number'/)
  assert.match(migration, /not exists \(/)
  assert.match(migration, /duplicate photo ID/)
  assert.match(migration, /revoke all privileges on function public\.append_job_photo/)
  assert.match(migration, /grant execute on function public\.append_job_photo\(uuid, jsonb\) to authenticated/)
})

test('signed URL-e są odświeżane po powrocie PWA na pierwszy plan', () => {
  assert.ok(jobsApi.includes('const SIGNED_STORAGE_URL_TTL_SECONDS = 60 * 10'))
  assert.match(jobsApi, /createSignedUrl\(item\.path, SIGNED_STORAGE_URL_TTL_SECONDS\)/)
  assert.match(app, /window\.addEventListener\('focus', refreshSignedStorageUrls\)/)
  assert.match(app, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/)
  assert.match(app, /document\.visibilityState === 'visible'/)
  assert.match(app, /window\.removeEventListener\('focus', refreshSignedStorageUrls\)/)
  assert.match(app, /document\.removeEventListener\('visibilitychange', onVisibilityChange\)/)
})

test('realizacje w koszu również dostają świeże signed URL-e', () => {
  const deletedJobs = section(jobsApi, 'export async function getDeletedJobs()', 'export async function createSupabaseJob(')
  assert.match(deletedJobs, /Promise\.all\(/)
  assert.match(deletedJobs, /resolveJobStorageUrls\(mapSupabaseJobToAppJob\(row\)\)/)
})
