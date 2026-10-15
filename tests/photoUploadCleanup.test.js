import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanupUnreferencedPhotoUpload } from '../src/lib/photoUploadCleanup.js'

const photo = { id: 'photo-1', path: 'jobs/job-1/photos/123-photo.png' }
const silentLogger = { error() {} }

test('deletes an uploaded photo only after a successful read confirms no metadata reference', async () => {
  const deleted = []
  const result = await cleanupUnreferencedPhotoUpload({
    jobId: 'job-1',
    photo,
    readJobFiles: async () => ({ data: { photos: [], main_photo: null, documents: {} }, error: null }),
    deleteFile: async path => deleted.push(path),
    logger: silentLogger,
  })

  assert.equal(result, true)
  assert.deepEqual(deleted, [photo.path])
})

test('preserves a photo when the append RPC may have committed despite an error response', async () => {
  let deleteCount = 0
  const result = await cleanupUnreferencedPhotoUpload({
    jobId: 'job-1',
    photo,
    readJobFiles: async () => ({
      data: { photos: [{ id: photo.id, path: photo.path }], main_photo: null, documents: {} },
      error: null,
    }),
    deleteFile: async () => { deleteCount += 1 },
    logger: silentLogger,
  })

  assert.equal(result, false)
  assert.equal(deleteCount, 0)
})

test('preserves a photo if any current job metadata references its path', async () => {
  let deleteCount = 0
  const result = await cleanupUnreferencedPhotoUpload({
    jobId: 'job-1',
    photo,
    readJobFiles: async () => ({
      data: { photos: [], main_photo: null, documents: { attachments: [{ path: photo.path }] } },
      error: null,
    }),
    deleteFile: async () => { deleteCount += 1 },
    logger: silentLogger,
  })

  assert.equal(result, false)
  assert.equal(deleteCount, 0)
})

test('preserves a photo if the reference check fails or the job cannot be read', async () => {
  let deleteCount = 0
  const cases = [
    { data: null, error: new Error('read failed') },
    { data: null, error: null },
  ]

  for (const readResult of cases) {
    const result = await cleanupUnreferencedPhotoUpload({
      jobId: 'job-1',
      photo,
      readJobFiles: async () => readResult,
      deleteFile: async () => { deleteCount += 1 },
      logger: silentLogger,
    })
    assert.equal(result, false)
  }

  assert.equal(deleteCount, 0)
})

test('does not throw or claim cleanup when Storage deletion fails', async () => {
  const result = await cleanupUnreferencedPhotoUpload({
    jobId: 'job-1',
    photo,
    readJobFiles: async () => ({ data: { photos: [], main_photo: null, documents: {} }, error: null }),
    deleteFile: async () => { throw new Error('remove failed') },
    logger: silentLogger,
  })

  assert.equal(result, false)
})
