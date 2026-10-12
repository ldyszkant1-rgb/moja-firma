export function calculateEditedCostAmounts(amount, vatRate) {
  const rate = Number(vatRate ?? 0)
  const roundMoney = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100
  const netAmount = roundMoney(amount)
  const grossAmount = roundMoney(netAmount * (1 + rate / 100))
  const vatAmount = roundMoney(grossAmount - netAmount)

  return {
    amount: netAmount,
    amountBasis: 'netto',
    vatRate: rate,
    netAmount,
    vatAmount,
    grossAmount,
  }
}
