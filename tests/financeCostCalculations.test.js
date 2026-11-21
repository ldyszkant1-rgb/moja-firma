import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateEditedCostAmounts } from '../src/lib/financeCostCalculations.js'
import {
  buildDistributionTransferNote,
  findDistributionTransfer,
} from '../src/lib/partnerSettlementHistory.js'

test('calculates net, VAT and gross for 23% VAT', () => {
  assert.deepEqual(calculateEditedCostAmounts(100, 23), {
    amount: 100,
    amountBasis: 'netto',
    vatRate: 23,
    netAmount: 100,
    vatAmount: 23,
    grossAmount: 123,
  })
})
test('keeps VAT at zero when rate is 0%', () => {
  assert.deepEqual(calculateEditedCostAmounts(100, 0), {
    amount: 100,
    amountBasis: 'netto',
    vatRate: 0,
    netAmount: 100,
    vatAmount: 0,
    grossAmount: 100,
  })
})

test('treats a missing VAT rate as 0%', () => {
  assert.deepEqual(calculateEditedCostAmounts(100, null), {
    amount: 100,
    amountBasis: 'netto',
    vatRate: 0,
    netAmount: 100,
    vatAmount: 0,
    grossAmount: 100,
  })
})

test('rounds gross and VAT amounts to two decimal places', () => {
  assert.deepEqual(calculateEditedCostAmounts(10.01, 8), {
    amount: 10.01,
    amountBasis: 'netto',
    vatRate: 8,
    netAmount: 10.01,
    vatAmount: 0.8,
    grossAmount: 10.81,
  })
})

test('links a full-settlement transfer to its exact distribution ID', () => {
  const distribution = { id: 'distribution-a', distributionDate: '2026-11-21' }
  const transfer = {
    id: 'transfer-a',
    transferDate: '2026-11-21',
    amount: 50,
    fromPerson: 'Paweł',
    toPerson: 'Łukasz',
    note: buildDistributionTransferNote(distribution.id),
  }

  assert.equal(
    findDistributionTransfer(distribution, [distribution], [transfer]),
    transfer
  )
})

test('does not attach one same-day transfer to multiple distributions', () => {
  const first = { id: 'distribution-a', distributionDate: '2026-11-21' }
  const second = { id: 'distribution-b', distributionDate: '2026-11-21' }
  const transfer = {
    id: 'transfer-a',
    transferDate: '2026-11-21',
    amount: 50,
    fromPerson: 'Paweł',
    toPerson: 'Łukasz',
    note: 'Pełne rozliczenie salda kosztów',
  }

  assert.equal(findDistributionTransfer(first, [first, second], [transfer]), null)
  assert.equal(findDistributionTransfer(second, [first, second], [transfer]), null)
})

test('keeps unmarked legacy full settlements linked only when unambiguous', () => {
  const distribution = {
    id: 'legacy-distribution',
    distributionDate: '2026-11-20',
    note: 'Podział wpłat zapisany przy rozliczeniu salda',
  }
  const transfer = {
    id: 'legacy-transfer',
    transferDate: '2026-11-20',
    amount: 25,
    fromPerson: 'Łukasz',
    toPerson: 'Paweł',
    note: 'Pełne rozliczenie salda kosztów',
  }

  assert.equal(
    findDistributionTransfer(distribution, [distribution], [transfer]),
    transfer
  )
  assert.equal(
    findDistributionTransfer(distribution, [distribution], [transfer, { ...transfer, id: 'another-transfer' }]),
    null
  )
})
