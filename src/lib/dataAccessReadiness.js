export function hasReadyDataAccess({
  authChecked,
  authOrganizationChecked,
  authOrganizationId,
  authSession,
  deviceLoading,
  deviceUser,
}) {
  const authenticatedSessionReady = Boolean(authSession && authOrganizationId)
  const legacyDeviceReady = Boolean(
    !authSession && !deviceLoading && deviceUser && authOrganizationId
  )

  return Boolean(
    authChecked &&
    authOrganizationChecked &&
    (authenticatedSessionReady || legacyDeviceReady)
  )
}
