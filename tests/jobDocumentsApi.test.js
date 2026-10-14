import test from 'node:test'
import assert from 'node:assert/strict'
import { createJobDocumentsApi } from '../src/lib/jobDocumentsApi.js'

function fakeSupabase(initialRow, { beforeFirstUpdate } = {}) {
  const row = structuredClone(initialRow)
  const updates = []
  let updateCount = 0

  const client = {
    from(table) {
      assert.equal(table, 'jobs')
      let operation = 'select'
      let patch = null
      const filters = {}
      const builder = {
        select() {
          return builder
        },
        update(value) {
          operation = 'update'
          patch = value
          return builder
        },
        eq(column, value) {
          filters[column] = value
          return builder
        },
        is(column, value) {
          filters[column] = value
          return builder
        },
        async maybeSingle() {
          if (operation === 'select') {
            return { data: row.id === filters.id && row.deleted_at == null ? structuredClone(row) : null, error: null }
          }

          updateCount += 1
          if (updateCount === 1 && beforeFirstUpdate) beforeFirstUpdate(row)
          if (row.id !== filters.id || row.deleted_at != null) return { data: null, error: null }

          if (Object.hasOwn(filters, 'documents')) {
            const expected = filters.documents == null ? null : JSON.parse(filters.documents)
            if (JSON.stringify(row.documents) !== JSON.stringify(expected)) {
              return { data: null, error: null }
            }
          }

          updates.push(structuredClone(patch))
          Object.assign(row, patch)
          return { data: { documents: structuredClone(row.documents) }, error: null }
        },
      }
      return builder
    },
  }

  return { client, row, updates, get updateCount() { return updateCount } }
}

test('updates only documents and preserves unrelated job fields', async () => {
  const fake = fakeSupabase({
    id: 'job-1',
    name: 'Realizacja aktualna',
    status: 'W toku',
    documents: { material: { path: 'material.pdf' }, attachments: [] },
    deleted_at: null,
  })
  const api = createJobDocumentsApi(fake.client)

  const result = await api.updateJobDocuments('job-1', (documents) => ({
    ...documents,
    attachments: [{ id: 'a', path: 'a.pdf' }],
  }))

  assert.deepEqual(result.attachments, [{ id: 'a', path: 'a.pdf' }])
  assert.equal(fake.row.name, 'Realizacja aktualna')
  assert.equal(fake.row.status, 'W toku')
  assert.deepEqual(fake.updates, [{
    documents: { material: { path: 'material.pdf' }, attachments: [{ id: 'a', path: 'a.pdf' }] },
  }])
})

test('re-reads and reapplies a change after another writer updates documents', async () => {
  const fake = fakeSupabase({
    id: 'job-2',
    documents: { material: { path: 'material.pdf' }, attachments: [] },
    deleted_at: null,
  }, {
    beforeFirstUpdate(row) {
      row.documents = {
        ...row.documents,
        assembly: { path: 'assembly.pdf' },
        attachments: [{ id: 'other', path: 'other.pdf' }],
      }
    },
  })
  const api = createJobDocumentsApi(fake.client)

  const result = await api.updateJobDocuments('job-2', (documents) => ({
    ...(documents || {}),
    attachments: [...(documents?.attachments || []), { id: 'mine', path: 'mine.pdf' }],
  }))

  assert.deepEqual(result.attachments, [
    { id: 'other', path: 'other.pdf' },
    { id: 'mine', path: 'mine.pdf' },
  ])
  assert.deepEqual(result.assembly, { path: 'assembly.pdf' })
  assert.equal(fake.updateCount, 2)
})

test('rejects missing job IDs before querying Supabase', async () => {
  let queried = false
  const api = createJobDocumentsApi({
    from() {
      queried = true
      throw new Error('must not query')
    },
  })

  await assert.rejects(api.updateJobDocuments('', () => ({})), /Brak ID roboty/)
  assert.equal(queried, false)
})

test('reports a conflict after the retry limit is exhausted', async () => {
  const fake = fakeSupabase({
    id: 'job-3',
    documents: { attachments: [] },
    deleted_at: null,
  }, {
    beforeFirstUpdate(row) {
      row.documents = { attachments: [{ id: 'external', path: 'external.pdf' }] }
    },
  })
  // Cause a competing write immediately before every CAS update.
  const originalFrom = fake.client.from.bind(fake.client)
  let competingWrite = 0
  fake.client.from = (table) => {
    const builder = originalFrom(table)
    const originalUpdate = builder.update.bind(builder)
    builder.update = (patch) => {
      competingWrite += 1
      fake.row.documents = {
        ...(fake.row.documents || {}),
        competingVersion: competingWrite,
      }
      return originalUpdate(patch)
    }
    return builder
  }
  const api = createJobDocumentsApi(fake.client, { maxAttempts: 2 })

  await assert.rejects(
    api.updateJobDocuments('job-3', (documents) => ({ ...(documents || {}), local: true })),
    /równolegle zmieniona/
  )
})
