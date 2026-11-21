import test from 'node:test'
import assert from 'node:assert/strict'
import { hasReadyDataAccess } from '../src/lib/dataAccessReadiness.js'

test('does not load company data before an authenticated user has an organization', () => {
  assert.equal(hasReadyDataAccess({
    authChecked: true,
    authOrganizationChecked: true,
    authOrganizationId: null,
    authSession: { user: { id: 'user-1' } },
    deviceLoading: false,
    deviceUser: null,
  }), false)
})

test('allows authenticated data access only after organization membership loads', () => {
  assert.equal(hasReadyDataAccess({
    authChecked: true,
    authOrganizationChecked: true,
    authOrganizationId: 'organization-1',
    authSession: { user: { id: 'user-1' } },
    deviceLoading: false,
    deviceUser: null,
  }), true)
})

test('allows legacy device access only after device and organization checks finish', () => {
  const readyState = {
    authChecked: true,
    authOrganizationChecked: true,
    authOrganizationId: 'organization-1',
    authSession: null,
    deviceLoading: false,
    deviceUser: 'Łukasz',
  }

  assert.equal(hasReadyDataAccess(readyState), true)
  assert.equal(hasReadyDataAccess({ ...readyState, authOrganizationId: null }), false)
  assert.equal(hasReadyDataAccess({ ...readyState, deviceLoading: true }), false)
})
