const TRANSFER_REFERENCE_PREFIX = '[profit-distribution:'

export function buildDistributionTransferNote(distributionId) {
  if (!distributionId) return 'Pełne rozliczenie salda kosztów'
  return `Pełne rozliczenie salda kosztów ${TRANSFER_REFERENCE_PREFIX}${distributionId}]`
}

export function findDistributionTransfer(distribution, distributions, transfers) {
  if (!distribution?.id) return null

  const reference = `${TRANSFER_REFERENCE_PREFIX}${distribution.id}]`
  const referencedTransfers = transfers.filter((transfer) =>
    String(transfer.note || '').includes(reference)
  )
  if (referencedTransfers.length === 1) return referencedTransfers[0]
  if (referencedTransfers.length > 1) return null

  // Old records have no explicit reference. Link only a unique, clearly
  // marked full settlement to a unique distribution of the same kind/date.
  const settlementDistributions = distributions.filter((item) =>
    item.distributionDate === distribution.distributionDate &&
    String(item.note || '').includes('zapisany przy rozliczeniu salda')
  )
  const settlementTransfers = transfers.filter((item) =>
    item.transferDate === distribution.distributionDate &&
    String(item.note || '').startsWith('Pełne rozliczenie salda kosztów') &&
    Number(item.amount || 0) > 0 &&
    item.fromPerson &&
    item.toPerson
  )

  if (
    settlementDistributions.length === 1 &&
    String(settlementDistributions[0].id) === String(distribution.id) &&
    settlementTransfers.length === 1
  ) {
    return settlementTransfers[0]
  }

  return null
}
