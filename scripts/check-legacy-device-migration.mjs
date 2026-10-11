import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const path = 'supabase/migrations/20261011090000_lock_legacy_device_enrollment.sql';
const sql = readFileSync(path, 'utf8');
const permissionsPath = 'supabase/migrations/20261011110000_harden_legacy_device_claim_permissions.sql';
const permissionsSql = readFileSync(permissionsPath, 'utf8');

const checks = [
  ['requires an authenticated session', /auth\.uid\(\)/i],
  ['only allows the two legacy users', /p_user_name not in\s*\('Łukasz',\s*'Paweł'\)/i],
  ['rejects unknown device IDs instead of creating them', /if assigned_user is null then raise exception/i],
  ['checks device ownership', /if assigned_user <> p_user_name then raise exception/i],
  ['rejects a device bound to another auth user', /auth_user_id is not null and du\.auth_user_id <> current_user_id/i],
  ['does not self-enroll by inserting device_users rows', /insert\s+into\s+public\.device_users/i],
];

const permissionChecks = [
  ['revokes direct writes to device assignments', /revoke all privileges on table public\.device_users from public, anon, authenticated/i],
  ['keeps authenticated own-row reads available', /grant select on table public\.device_users to authenticated/i],
  ['revokes public access to private claim implementation', /revoke all privileges on function private\.claim_legacy_device/i],
  ['allows authenticated RPC execution', /grant execute on function public\.claim_legacy_device/i],
];

for (const [label, pattern] of permissionChecks) {
  assert.equal(pattern.test(permissionsSql), true, label);
  console.log(`PASS: ${label}`);
}

for (const [label, pattern] of checks) {
  const found = pattern.test(sql);
  if (label.startsWith('does not self-enroll')) {
    assert.equal(found, false, label);
  } else {
    assert.equal(found, true, label);
  }
  console.log(`PASS: ${label}`);
}
