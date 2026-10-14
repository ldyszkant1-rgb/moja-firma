import test from 'node:test'
import assert from 'node:assert/strict'
import { createStorageFileApi } from '../src/lib/storageFiles.js'

function createFakeSupabase({
  uploadResult = { error: null },
  signedUrlResult = { data: { signedUrl: 'https://signed.example/file' }, error: null },
  removeResult = { error: null },
} = {}) {
  const calls = []
  const client = {
    storage: {
      from(bucket) {
        calls.push({ method: 'from', bucket })
        return {
          async upload(path, file, options) {
            calls.push({ method: 'upload', path, file, options })
            return uploadResult
          },
          async createSignedUrl(path, ttl) {
            calls.push({ method: 'createSignedUrl', path, ttl })
            return signedUrlResult
          },
          async remove(paths) {
            calls.push({ method: 'remove', paths })
            return removeResult
          },
        }
      },
    },
  }
  return { client, calls }
}

const silentLogger = { error() {} }

test('uploads to the expected job folder and returns a signed URL', async () => {
  const { client, calls } = createFakeSupabase()
  const api = createStorageFileApi(client, { now: () => 123, logger: silentLogger })
  const file = { name: 'zażółć raport.pdf', type: 'application/pdf' }

  const result = await api.uploadSupabaseFile('job-7', 'documents/general', file)

  assert.deepEqual(result, {
    path: 'jobs/job-7/documents/general/123-zazolc_raport.pdf',
    url: 'https://signed.example/file',
  })
  assert.deepEqual(calls.find(call => call.method === 'upload').options, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'application/pdf',
  })
  assert.equal(calls.find(call => call.method === 'createSignedUrl').ttl, 86400)
})

test('uses a safe default content type when the file has no MIME type', async () => {
  const { client, calls } = createFakeSupabase()
  const api = createStorageFileApi(client, { now: () => 1, logger: silentLogger })

  await api.uploadSupabaseFile('job-1', 'documents/general', { name: 'scan.pdf' })

  assert.equal(calls.find(call => call.method === 'upload').options.contentType, 'application/octet-stream')
})

test('rejects missing job ID or file before calling Storage', async () => {
  const { client, calls } = createFakeSupabase()
  const api = createStorageFileApi(client, { logger: silentLogger })

  await assert.rejects(api.uploadSupabaseFile('', 'documents/general', { name: 'a.pdf' }), /Brak ID roboty/)
  await assert.rejects(api.uploadSupabaseFile('job-1', 'documents/general', null), /Brak pliku/)
  assert.equal(calls.length, 0)
})

test('does not request a signed URL or delete anything when upload fails', async () => {
  const failure = new Error('upload denied')
  const { client, calls } = createFakeSupabase({ uploadResult: { error: failure } })
  const api = createStorageFileApi(client, { now: () => 5, logger: silentLogger })

  await assert.rejects(api.uploadSupabaseFile('job-1', 'documents/general', { name: 'a.pdf' }), error => error === failure)
  assert.equal(calls.some(call => call.method === 'createSignedUrl'), false)
  assert.equal(calls.some(call => call.method === 'remove'), false)
})

test('cleans up the uploaded object when signed URL creation fails', async () => {
  const failure = new Error('signed URL denied')
  const { client, calls } = createFakeSupabase({ signedUrlResult: { data: null, error: failure } })
  const api = createStorageFileApi(client, { now: () => 6, logger: silentLogger })

  await assert.rejects(api.uploadSupabaseFile('job-2', 'documents/general', { name: 'a.pdf' }), error => error === failure)
  assert.deepEqual(calls.find(call => call.method === 'remove').paths, [
    'jobs/job-2/documents/general/6-a.pdf',
  ])
})

test('preserves the signed URL error and reports cleanup failure', async () => {
  const signedFailure = new Error('signed URL denied')
  const cleanupFailure = new Error('remove denied')
  const { client, calls } = createFakeSupabase({
    signedUrlResult: { data: null, error: signedFailure },
    removeResult: { error: cleanupFailure },
  })
  const api = createStorageFileApi(client, { now: () => 7, logger: silentLogger })

  await assert.rejects(
    api.uploadSupabaseFile('job-3', 'documents/general', { name: 'a.pdf' }),
    error => error === signedFailure && error.cleanupError === cleanupFailure
  )
  assert.equal(calls.some(call => call.method === 'remove'), true)
})

test('does not request removal for an empty path', async () => {
  const { client, calls } = createFakeSupabase()
  const api = createStorageFileApi(client, { logger: silentLogger })

  await api.deleteSupabaseFile(null)
  assert.equal(calls.length, 0)
})

test('propagates Storage removal errors', async () => {
  const failure = new Error('remove denied')
  const { client, calls } = createFakeSupabase({ removeResult: { error: failure } })
  const api = createStorageFileApi(client, { logger: silentLogger })

  await assert.rejects(api.deleteSupabaseFile('jobs/job-4/documents/general/a.pdf'), error => error === failure)
  assert.deepEqual(calls.find(call => call.method === 'remove').paths, [
    'jobs/job-4/documents/general/a.pdf',
  ])
})
