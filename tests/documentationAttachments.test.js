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
