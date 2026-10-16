import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'

const url = process.env.API_URL
const anonKey = process.env.ANON_KEY
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

assert.ok(url && /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url), 'Refusing to run unless Supabase API is local')
assert.ok(anonKey, 'Missing local ANON_KEY')
assert.ok(serviceRoleKey, 'Missing local SERVICE_ROLE_KEY')

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceRoleKey, options)
const anon = createClient(url, anonKey, options)
const bucket = 'aeroinstal-files'
const password = `Local-E2E-${randomUUID()}-aA9!`
const emailTag = randomUUID()
const createdUsers = []
const uploadedPaths = []

async function createTestUser(label) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${label}-${emailTag}@example.test`,
    password,
    email_confirm: true,
  })
  if (error) throw error
  createdUsers.push(data.user.id)
  const client = createClient(url, anonKey, options)
  const { error: signInError } = await client.auth.signInWithPassword({
    email: data.user.email,
    password,
  })
  if (signInError) throw signInError
  return { id: data.user.id, client }
}

async function expectDenied(label, operation) {
  const result = await operation()
  assert.ok(result.error, `${label} should be denied`)
}

async function fetchSignedUrl(client, path) {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60)
  assert.ifError(error)
  assert.ok(data?.signedUrl, 'Expected a signed URL')
  const response = await fetch(data.signedUrl)
  assert.equal(response.status, 200, 'Signed URL should read the private object')
  return Buffer.from(await response.arrayBuffer()).toString('utf8')
}

test('private Storage: partner access, signed URLs, RLS denials and lifecycle operations', async (t) => {
  let userA
  let userB
  let outsider
  const orgA = randomUUID()
  const orgB = randomUUID()
  const jobA = randomUUID()
  const jobB = randomUUID()
  const photoPath = `jobs/${jobA}/photos/e2e-photo.jpg`
  const jobPaths = [
    `jobs/${jobA}/main/e2e-main.jpg`,
    photoPath,
    `jobs/${jobA}/documents/material/e2e-material.pdf`,
    `jobs/${jobA}/documents/assembly/e2e-assembly.pdf`,
  ]

  try {
    const { data: bucketData, error: bucketError } = await admin.storage.getBucket(bucket)
    assert.ifError(bucketError)
    assert.equal(bucketData.public, false, 'The real private-bucket migration must have made this bucket private')

    userA = await createTestUser('lukasz')
    userB = await createTestUser('pawel')
    outsider = await createTestUser('outsider')

    const { error: membersError } = await admin.from('organization_members').insert([
      { organization_id: orgA, user_id: userA.id, role: 'owner' },
      { organization_id: orgA, user_id: userB.id, role: 'admin' },
      { organization_id: orgB, user_id: outsider.id, role: 'owner' },
    ])
    assert.ifError(membersError)

    const { error: jobsError } = await admin.from('jobs').insert([
      { id: jobA, organization_id: orgA, name: 'Synthetic shared job', photos: [] },
      { id: jobB, organization_id: orgB, name: 'Synthetic foreign job', photos: [] },
    ])
    assert.ifError(jobsError)

    await t.test('both partners can upload and read main photo, gallery and documents', async () => {
      const bodies = ['main-photo', 'gallery-photo', 'material-pdf', 'assembly-pdf']
      for (let i = 0; i < jobPaths.length; i += 1) {
        const isPdf = jobPaths[i].endsWith('.pdf')
        const { error } = await userA.client.storage.from(bucket).upload(
          jobPaths[i],
          new Blob([bodies[i]], { type: isPdf ? 'application/pdf' : 'image/jpeg' }),
          { contentType: isPdf ? 'application/pdf' : 'image/jpeg', upsert: false },
        )
        assert.ifError(error)
        uploadedPaths.push(jobPaths[i])
      }

      for (let i = 0; i < jobPaths.length; i += 1) {
        const { data, error } = await userB.client.storage.from(bucket).download(jobPaths[i])
        assert.ifError(error)
        assert.ok(data, 'Second partner should receive the object')
        const text = await data.text()
        assert.equal(text, ['main-photo', 'gallery-photo', 'material-pdf', 'assembly-pdf'][i])
      }
    })

    await t.test('signed URLs work and can be refreshed on return to the app', async () => {
      assert.equal(await fetchSignedUrl(userA.client, photoPath), 'gallery-photo')
      // Mirrors the app's foreground refresh: request a fresh signed URL instead of
      // relying on a persisted/public URL. No production URL or token is used here.
      assert.equal(await fetchSignedUrl(userA.client, photoPath), 'gallery-photo')
      assert.equal(await fetchSignedUrl(userB.client, photoPath), 'gallery-photo')
    })

    await t.test('public object URL is disabled for the private bucket', async () => {
      const publicUrl = `${url}/storage/v1/object/public/${bucket}/${photoPath}`
      const response = await fetch(publicUrl)
      assert.notEqual(response.status, 200, 'Private objects must not be available via the public URL endpoint')
    })

    await t.test('upsert replacement succeeds for a partner and updates object contents', async () => {
      const { error } = await userA.client.storage.from(bucket).upload(
        photoPath,
        new Blob(['gallery-photo-replaced'], { type: 'image/jpeg' }),
        { contentType: 'image/jpeg', upsert: true },
      )
      assert.ifError(error)
      assert.equal(await fetchSignedUrl(userB.client, photoPath), 'gallery-photo-replaced')
    })

    await t.test('other organization and anonymous/no-session clients cannot read, sign, upload or delete', async () => {
      await expectDenied('Foreign organization read', () => outsider.client.storage.from(bucket).download(photoPath))
      await expectDenied('Foreign organization signed URL', () => outsider.client.storage.from(bucket).createSignedUrl(photoPath, 60))
      await expectDenied('Foreign organization upload', () => outsider.client.storage.from(bucket).upload(
        `jobs/${jobA}/photos/outsider.jpg`,
        new Blob(['not allowed'], { type: 'image/jpeg' }),
        { contentType: 'image/jpeg' },
      ))
      const foreignDelete = await outsider.client.storage.from(bucket).remove([photoPath])
      // RLS may reject with an error or hide the row and return an empty result.
      // In both cases the object must remain available to an authorized partner.
      if (foreignDelete.error) assert.ok(foreignDelete.error)
      await expectDenied('No-session read', () => anon.storage.from(bucket).download(photoPath))
      await expectDenied('No-session signed URL', () => anon.storage.from(bucket).createSignedUrl(photoPath, 60))
      await expectDenied('No-session upload', () => anon.storage.from(bucket).upload(
        `jobs/${jobA}/photos/anonymous.jpg`,
        new Blob(['not allowed'], { type: 'image/jpeg' }),
        { contentType: 'image/jpeg' },
      ))
      await expectDenied('Unknown job path', () => userA.client.storage.from(bucket).upload(
        `jobs/${randomUUID()}/photos/orphan.jpg`,
        new Blob(['orphan'], { type: 'image/jpeg' }),
        { contentType: 'image/jpeg' },
      ))
      await expectDenied('Invalid top-level path', () => userA.client.storage.from(bucket).upload(
        `not-jobs/${jobA}/photos/invalid.jpg`,
        new Blob(['invalid'], { type: 'image/jpeg' }),
        { contentType: 'image/jpeg' },
      ))

      // Some Storage delete responses can be empty when RLS hides a row; prove the
      // denial by verifying the original object remains readable by an authorized partner.
      assert.equal(await fetchSignedUrl(userB.client, photoPath), 'gallery-photo-replaced')
    })

    await t.test('photo RPC accepts valid metadata and rejects duplicate/cross-organization payloads', async () => {
      const photo = {
        id: `e2e-${randomUUID()}`,
        name: 'e2e-photo.jpg',
        path: photoPath,
        type: 'image/jpeg',
        size: Buffer.byteLength('gallery-photo-replaced'),
      }
      const { data, error } = await userA.client.rpc('append_job_photo', {
        p_job_id: jobA,
        p_photo: photo,
      })
      assert.ifError(error)
      assert.equal(data.id, jobA)

      const { error: duplicateError } = await userA.client.rpc('append_job_photo', {
        p_job_id: jobA,
        p_photo: photo,
      })
      assert.ok(duplicateError, 'Duplicate photo ID must be rejected')

      const { error: crossOrgError } = await userA.client.rpc('append_job_photo', {
        p_job_id: jobB,
        p_photo: {
          ...photo,
          id: `foreign-${randomUUID()}`,
          path: `jobs/${jobB}/photos/foreign.jpg`,
        },
      })
      assert.ok(crossOrgError, 'Cross-organization metadata append must be rejected')
    })

    await t.test('authorized partner can delete a file after metadata changes', async () => {
      const removablePath = jobPaths[3]
      const { error } = await userB.client.storage.from(bucket).remove([removablePath])
      assert.ifError(error)
      const { error: readAfterDeleteError } = await userA.client.storage.from(bucket).download(removablePath)
      assert.ok(readAfterDeleteError, 'Deleted file should no longer be readable')
    })
  } finally {
    if (uploadedPaths.length) {
      await admin.storage.from(bucket).remove(uploadedPaths).catch(() => {})
    }
    if (userA && userB && outsider) {
      await admin.from('organization_members').delete().in('user_id', [userA.id, userB.id, outsider.id]).catch(() => {})
    }
    await admin.from('jobs').delete().in('id', [jobA, jobB]).catch(() => {})
    for (const id of createdUsers) {
      await admin.auth.admin.deleteUser(id).catch(() => {})
    }
  }
})
