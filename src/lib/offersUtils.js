export function parseOfferDecimal(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 0
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}

export function calculateOfferTotal(offer) {
  return (
    parseOfferDecimal(offer?.quantities?.mb) * parseOfferDecimal(offer?.rates?.mb) +
    parseOfferDecimal(offer?.quantities?.m2) * parseOfferDecimal(offer?.rates?.m2) +
    parseOfferDecimal(offer?.quantities?.kg) * parseOfferDecimal(offer?.rates?.kg)
  )
}
