import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationPath = new URL(
  '../supabase/migrations/20261012150000_harden_storage_object_permissions.sql',
  import.meta.url,
)
const sql = readFileSync(migrationPath, 'utf8')

test('revokes dangerous table-level Storage privileges', () => {
  assert.match(
    sql,
    /REVOKE\s+TRUNCATE\s*,\s*REFERENCES\s*,\s*TRIGGER\s+ON\s+TABLE\s+storage\.objects\s+FROM\s+anon\s*,\s*authenticated/i,
  )
})

test('defines organization-scoped upload, update and delete policies', () => {
  for (const operation of ['upload', 'update', 'delete']) {
    assert.match(
      sql,
      new RegExp(
        `CREATE POLICY "Aeroinstal files - ${operation}"[\\s\\S]*?FOR ${operation.toUpperCase()}[\\s\\S]*?TO authenticated`,
        'i',
      ),
      `missing authenticated ${operation} policy`,
    )
  }

  const policies = sql.split(/CREATE POLICY "Aeroinstal files - /i).slice(1)
  assert.equal(policies.length, 3, 'expected exactly three mutation policies')

  for (const policy of policies) {
    assert.match(policy, /bucket_id\s*=\s*'aeroinstal-files'/i)
    assert.match(policy, /\(storage\.foldername\(name\)\)\[2\]/i)
    assert.match(policy, /j\.organization_id\s*=\s*private\.current_organization_id\(\)/i)
  }
})

test('does not drop or redefine the existing Storage read policy', () => {
  assert.doesNotMatch(sql, /DROP POLICY[^;]*"Aeroinstal files - read"/i)
  assert.doesNotMatch(sql, /CREATE POLICY[^;]*"Aeroinstal files - read"/i)
})

test('limits the mutation policies to the intended bucket and job paths', () => {
  assert.equal((sql.match(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*'jobs'/gi) || []).length, 4)
})
