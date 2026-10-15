import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendDocumentationAttachment,
  getDocumentationAttachments,
  removeDocumentationAttachment,
  saveDocumentationAttachment,
  deleteDocumentationAttachment,
} from '../src/lib/documentationAttachments.js'

test('returns an empty list for missing or invalid attachments', () => {
  assert.deepEqual(getDocumentationAttachments(null), [])
  assert.deepEqual(getDocumentationAttachments({ attachments: 'wrong-shape' }), [])
})

test('appends an attachment without replacing formal documents or existing attachments', () => {
  const material = { name: 'material.pdf', path: 'jobs/1/documents/material/a.pdf' }
  const first = { id: 'a', name: 'one.pdf' }
  const second = { id: 'b', name: 'two.pdf' }
  const result = appendDocumentationAttachment({ material, attachments: [first] }, second)
  assert.deepEqual(result.material, material)
  assert.deepEqual(result.attachments, [first, second])
})

test('removes only the selected attachment and preserves other document fields', () => {
  const material = { name: 'material.pdf' }
  const first = { id: 'a', name: 'one.pdf' }
  const second = { id: 'b', name: 'two.pdf' }
  const result = removeDocumentationAttachment({ material, attachments: [first, second] }, 'a')
  assert.deepEqual(result.material, material)
  assert.deepEqual(result.attachments, [second])
})

test('successful upload appends to the latest documents without losing another writer changes', async () => {
  const job = { id: 'job-1', name: 'Original name', documents: { attachments: [] } }
  let currentDocuments = { attachments: [{ id: 'other', path: 'other.pdf' }], assembly: { path: 'assembly.pdf' } }
  let deleteCount = 0
  const saved = await saveDocumentationAttachment({
    job,
    file: { name: 'mine.pdf', type: 'application/pdf', size: 12 },
    uploadFile: async () => ({ path: 'jobs/job-1/documents/general/mine.pdf', url: 'signed-url' }),
    saveDocuments: async (_jobId, transform) => {
      currentDocuments = transform(currentDocuments)
      return currentDocuments
    },
    deleteFile: async () => { deleteCount += 1 },
    createAttachment: (file, uploaded) => ({ id: 'mine', name: file.name, ...uploaded }),
  })
  assert.deepEqual(saved.documents.attachments.map(item => item.id), ['other', 'mine'])
  assert.deepEqual(saved.documents.assembly, { path: 'assembly.pdf' })
  assert.equal(saved.name, 'Original name')
  assert.equal(deleteCount, 0)
})

test('failed metadata save rolls back only its attachment and preserves concurrent changes', async () => {
  const job = { id: 'job-2', documents: { attachments: [] } }
  let currentDocuments = { attachments: [] }
  let saveCount = 0
  const deleted = []
  const writeFailure = new Error('network timeout')

  await assert.rejects(saveDocumentationAttachment({
    job,
    file: { name: 'mine.pdf', type: 'application/pdf', size: 12 },
    uploadFile: async () => ({ path: 'mine.pdf', url: 'signed-url' }),
    saveDocuments: async (_jobId, transform) => {
      saveCount += 1
      if (saveCount === 1) {
        // Simulate a request that committed, then lost its response, followed by
        // a concurrent edit before rollback starts.
        currentDocuments = transform(currentDocuments)
        currentDocuments = {
          ...currentDocuments,
          assembly: { path: 'new-assembly.pdf' },
          attachments: [...currentDocuments.attachments, { id: 'other', path: 'other.pdf' }],
        }
        throw writeFailure
      }
      currentDocuments = transform(currentDocuments)
      return currentDocuments
    },
    deleteFile: async path => { deleted.push(path) },
    createAttachment: (file, uploaded) => ({ id: 'mine', name: file.name, ...uploaded }),
  }), error => error === writeFailure)

  assert.equal(saveCount, 2)
  assert.deepEqual(currentDocuments.attachments, [{ id: 'other', path: 'other.pdf' }])
  assert.deepEqual(currentDocuments.assembly, { path: 'new-assembly.pdf' })
  assert.deepEqual(deleted, ['mine.pdf'])
})

test('keeps the uploaded object when rollback cannot be confirmed', async () => {
  const job = { id: 'job-3', documents: { attachments: [] } }
  const writeFailure = new Error('write timeout')
  const rollbackFailure = new Error('rollback timeout')
  let saveCount = 0
  let deleteCount = 0

  await assert.rejects(saveDocumentationAttachment({
    job,
    file: { name: 'uncertain.pdf', type: 'application/pdf', size: 3 },
    uploadFile: async () => ({ path: 'uncertain.pdf', url: 'signed-url' }),
    saveDocuments: async () => {
      saveCount += 1
      throw saveCount === 1 ? writeFailure : rollbackFailure
    },
    deleteFile: async () => { deleteCount += 1 },
    createAttachment: (file, uploaded) => ({ id: 'x', name: file.name, ...uploaded }),
  }), error => error === writeFailure && error.restoreError === rollbackFailure)

  assert.equal(deleteCount, 0)
})

test('does not delete Storage object if metadata removal fails', async () => {
  const attachment = { id: 'a', name: 'one.pdf', path: 'one.pdf' }
  const job = { id: 'job-4', documents: { attachments: [attachment] } }
  let deleteCount = 0
  await assert.rejects(deleteDocumentationAttachment({
    job,
    attachmentId: 'a',
    saveDocuments: async () => { throw new Error('database unavailable') },
    deleteFile: async () => { deleteCount += 1 },
  }), /database unavailable/)
  assert.equal(deleteCount, 0)
})

test('restores attachment when metadata removal committed but its response was lost', async () => {
  const attachment = { id: 'a', name: 'one.pdf', path: 'one.pdf' }
  const job = { id: 'job-ambiguous-delete', documents: { attachments: [attachment] } }
  let currentDocuments = {
    attachments: [attachment],
    material: { path: 'material.pdf' },
  }
  let saveCount = 0
  let deleteCount = 0
  const writeFailure = new Error('response lost after commit')

  await assert.rejects(deleteDocumentationAttachment({
    job,
    attachmentId: 'a',
    saveDocuments: async (_jobId, transform) => {
      saveCount += 1
      currentDocuments = transform(currentDocuments)
      if (saveCount === 1) {
        // The database write committed, but the client received an error.
        currentDocuments = {
          ...currentDocuments,
          assembly: { path: 'new-assembly.pdf' },
        }
        throw writeFailure
      }
      return currentDocuments
    },
    deleteFile: async () => { deleteCount += 1 },
  }), error => error === writeFailure)

  assert.equal(saveCount, 2)
  assert.equal(deleteCount, 0)
  assert.deepEqual(currentDocuments.attachments, [attachment])
  assert.deepEqual(currentDocuments.material, { path: 'material.pdf' })
  assert.deepEqual(currentDocuments.assembly, { path: 'new-assembly.pdf' })
})

test('restores only the deleted attachment when Storage deletion fails, preserving concurrent changes', async () => {
  const attachment = { id: 'a', name: 'one.pdf', path: 'one.pdf' }
  const job = { id: 'job-5', documents: { attachments: [attachment] } }
  let currentDocuments = { attachments: [attachment], material: { path: 'material.pdf' } }
  let saveCount = 0
  const storageFailure = new Error('storage unavailable')

  await assert.rejects(deleteDocumentationAttachment({
    job,
    attachmentId: 'a',
    saveDocuments: async (_jobId, transform) => {
      saveCount += 1
      currentDocuments = transform(currentDocuments)
      if (saveCount === 1) {
        currentDocuments = {
          ...currentDocuments,
          assembly: { path: 'new-assembly.pdf' },
          attachments: [...currentDocuments.attachments, { id: 'other', path: 'other.pdf' }],
        }
        return currentDocuments
      }
      return currentDocuments
    },
    deleteFile: async () => { throw storageFailure },
  }), error => error === storageFailure)

  assert.deepEqual(currentDocuments.attachments, [ { id: 'other', path: 'other.pdf' }, attachment ])
  assert.deepEqual(currentDocuments.material, { path: 'material.pdf' })
  assert.deepEqual(currentDocuments.assembly, { path: 'new-assembly.pdf' })
})
