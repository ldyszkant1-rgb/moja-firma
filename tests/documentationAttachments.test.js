import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendDocumentationAttachment,
  getDocumentationAttachments,
  removeDocumentationAttachment,
} from '../src/lib/documentationAttachments.js'

test('returns an empty list for missing or invalid attachments', () => {
  assert.deepEqual(getDocumentationAttachments(null), [])
  assert.deepEqual(getDocumentationAttachments({ attachments: 'wrong-shape' }), [])
})

test('appends an attachment without replacing formal documents or existing attachments', () => {
  const material = { name: 'material.pdf', path: 'jobs/1/documents/material/a.pdf' }
  const first = { id: 'a', name: 'one.pdf' }
  const second = { id: 'b', name: 'two.pdf' }

  const result = appendDocumentationAttachment(
    { material, attachments: [first] },
    second
  )

  assert.deepEqual(result.material, material)
  assert.deepEqual(result.attachments, [first, second])
})

test('removes only the selected attachment and preserves other document fields', () => {
  const material = { name: 'material.pdf' }
  const first = { id: 'a', name: 'one.pdf' }
  const second = { id: 'b', name: 'two.pdf' }

  const result = removeDocumentationAttachment(
    { material, attachments: [first, second] },
    'a'
  )

  assert.deepEqual(result.material, material)
  assert.deepEqual(result.attachments, [second])
})

test('removing an unknown attachment leaves the list unchanged', () => {
  const attachment = { id: 'a', name: 'one.pdf' }
  const result = removeDocumentationAttachment({ attachments: [attachment] }, 'missing')
  assert.deepEqual(result.attachments, [attachment])
})


test('cleans up an uploaded object when metadata persistence fails', async () => {
  const { saveDocumentationAttachment } = await import('../src/lib/documentationAttachments.js')
  const job = { id: 'job-1', documents: { material: { name: 'material.pdf' } } }
  const events = []
  const failure = new Error('database unavailable')
  let saveCount = 0

  await assert.rejects(
    saveDocumentationAttachment({
      job,
      file: { name: 'new.pdf', type: 'application/pdf', size: 12 },
      uploadFile: async () => {
        events.push('upload')
        return { path: 'jobs/job-1/documents/general/new.pdf', url: 'signed-url' }
      },
      saveJob: async (nextJob) => {
        saveCount += 1
        events.push(saveCount === 1 ? 'save-new-metadata' : 'restore-original-metadata')
        if (saveCount === 1) throw failure
        assert.deepEqual(nextJob, job)
      },
      deleteFile: async (path) => {
        events.push('delete:' + path)
      },
      createAttachment: (file, uploaded) => ({ id: 'new', name: file.name, ...uploaded }),
    }),
    (error) => error === failure
  )

  assert.deepEqual(events, [
    'upload',
    'save-new-metadata',
    'restore-original-metadata',
    'delete:jobs/job-1/documents/general/new.pdf',
  ])
})

test('successful retry saves one attachment and does not run cleanup', async () => {
  const { saveDocumentationAttachment } = await import('../src/lib/documentationAttachments.js')
  const job = { id: 'job-2', documents: { attachments: [] } }
  const attachment = { id: 'one', name: 'retry.pdf', path: 'jobs/job-2/documents/general/retry.pdf' }
  let cleanupCount = 0
  let persistedJob = null

  const saved = await saveDocumentationAttachment({
    job,
    file: { name: 'retry.pdf', type: 'application/pdf', size: 8 },
    uploadFile: async () => ({ path: attachment.path, url: 'signed-url' }),
    saveJob: async (nextJob) => {
      persistedJob = nextJob
      return nextJob
    },
    deleteFile: async () => { cleanupCount += 1 },
    createAttachment: () => attachment,
  })

  assert.equal(cleanupCount, 0)
  assert.deepEqual(saved.documents.attachments, [attachment])
  assert.deepEqual(persistedJob.documents.attachments, [attachment])
})

test('does not delete the Storage object when metadata removal fails', async () => {
  const { deleteDocumentationAttachment } = await import('../src/lib/documentationAttachments.js')
  const attachment = { id: 'a', name: 'one.pdf', path: 'jobs/job-3/documents/general/one.pdf' }
  const job = { id: 'job-3', documents: { attachments: [attachment] } }
  let deleteCount = 0

  await assert.rejects(
    deleteDocumentationAttachment({
      job,
      attachmentId: 'a',
      saveJob: async () => { throw new Error('database unavailable') },
      deleteFile: async () => { deleteCount += 1 },
    }),
    /database unavailable/
  )

  assert.equal(deleteCount, 0)
})

test('restores attachment metadata when Storage deletion fails, allowing a retry', async () => {
  const { deleteDocumentationAttachment } = await import('../src/lib/documentationAttachments.js')
  const attachment = { id: 'a', name: 'one.pdf', path: 'jobs/job-4/documents/general/one.pdf' }
  const job = { id: 'job-4', documents: { attachments: [attachment] } }
  const saves = []
  const failure = new Error('storage unavailable')

  await assert.rejects(
    deleteDocumentationAttachment({
      job,
      attachmentId: 'a',
      saveJob: async (nextJob) => {
        saves.push(nextJob)
        return nextJob
      },
      deleteFile: async () => { throw failure },
    }),
    (error) => error === failure
  )

  assert.equal(saves.length, 2)
  assert.deepEqual(saves[0].documents.attachments, [])
  assert.deepEqual(saves[1].documents.attachments, [attachment])
})


test('a retry after a failed save leaves only one attachment in persisted metadata', async () => {
  const { saveDocumentationAttachment } = await import('../src/lib/documentationAttachments.js')
  const job = { id: 'job-retry', documents: { attachments: [] } }
  const deletedPaths = []
  let attempt = 0
  let finalJob = null

  const saveAttempt = async (nextJob) => {
    attempt += 1
    if (attempt === 1) throw new Error('temporary database failure')
    finalJob = nextJob
    return nextJob
  }

  await assert.rejects(
    saveDocumentationAttachment({
      job,
      file: { name: 'retry.pdf', type: 'application/pdf', size: 8 },
      uploadFile: async (_jobId, file) => ({
        path: 'jobs/job-retry/documents/general/' + attempt + '-' + file.name,
        url: 'signed-url',
      }),
      saveJob: saveAttempt,
      deleteFile: async (path) => { deletedPaths.push(path) },
      createAttachment: (file, uploaded) => ({
        id: uploaded.path,
        name: file.name,
        path: uploaded.path,
        url: uploaded.url,
      }),
    }),
    /temporary database failure/
  )

  const saved = await saveDocumentationAttachment({
    job,
    file: { name: 'retry.pdf', type: 'application/pdf', size: 8 },
    uploadFile: async (_jobId, file) => ({
      path: 'jobs/job-retry/documents/general/retry-' + file.name,
      url: 'signed-url',
    }),
    saveJob: saveAttempt,
    deleteFile: async (path) => { deletedPaths.push(path) },
    createAttachment: (file, uploaded) => ({
      id: uploaded.path,
      name: file.name,
      path: uploaded.path,
      url: uploaded.url,
    }),
  })

  assert.equal(deletedPaths.length, 1)
  assert.equal(saved.documents.attachments.length, 1)
  assert.equal(finalJob.documents.attachments.length, 1)
})

test('reports when attachment metadata cannot be restored after Storage deletion fails', async () => {
  const { deleteDocumentationAttachment } = await import('../src/lib/documentationAttachments.js')
  const attachment = { id: 'a', name: 'one.pdf', path: 'jobs/job-5/documents/general/one.pdf' }
  const job = { id: 'job-5', documents: { attachments: [attachment] } }
  let saveCount = 0
  const storageFailure = new Error('storage unavailable')
  const restoreFailure = new Error('database restore unavailable')

  await assert.rejects(
    deleteDocumentationAttachment({
      job,
      attachmentId: 'a',
      saveJob: async () => {
        saveCount += 1
        if (saveCount === 2) throw restoreFailure
        return job
      },
      deleteFile: async () => { throw storageFailure },
    }),
    (error) => error === storageFailure && error.restoreError === restoreFailure
  )
})


test('keeps uploaded object when rollback cannot be confirmed', async () => {
  const { saveDocumentationAttachment } = await import('../src/lib/documentationAttachments.js')
  const job = { id: 'job-rollback', documents: { attachments: [] } }
  const writeFailure = new Error('write timeout')
  const rollbackFailure = new Error('rollback timeout')
  let saveCount = 0
  let deleteCount = 0

  await assert.rejects(
    saveDocumentationAttachment({
      job,
      file: { name: 'uncertain.pdf', type: 'application/pdf', size: 3 },
      uploadFile: async () => ({ path: 'jobs/job-rollback/documents/general/uncertain.pdf', url: 'signed-url' }),
      saveJob: async () => {
        saveCount += 1
        throw saveCount === 1 ? writeFailure : rollbackFailure
      },
      deleteFile: async () => { deleteCount += 1 },
      createAttachment: (file, uploaded) => ({ id: 'x', name: file.name, ...uploaded }),
    }),
    (error) => error === writeFailure && error.restoreError === rollbackFailure
  )

  assert.equal(saveCount, 2)
  assert.equal(deleteCount, 0)
})
