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

export function getInvoiceCustomerPaidAmount(
  grossAmount,
  allocatedPayments,
  legacyPaidAmount
) {
  const gross = Math.max(0, Number(grossAmount) || 0)
  const allocated = Math.max(0, Number(allocatedPayments) || 0)
  const legacyPaid = Math.max(0, Number(legacyPaidAmount) || 0)

  return Math.min(gross, Math.max(allocated, legacyPaid))
}
