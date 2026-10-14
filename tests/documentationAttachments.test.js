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

  await assert.rejects(
    saveDocumentationAttachment({
      job,
      file: { name: 'new.pdf', type: 'application/pdf', size: 12 },
      uploadFile: async () => {
        events.push('upload')
        return { path: 'jobs/job-1/documents/general/new.pdf', url: 'signed-url' }
      },
      saveJob: async () => {
        events.push('save')
        throw failure
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
    'save',
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
