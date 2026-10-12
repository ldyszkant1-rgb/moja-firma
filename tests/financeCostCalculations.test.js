import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateEditedCostAmounts } from '../src/lib/financeCostCalculations.js'

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
