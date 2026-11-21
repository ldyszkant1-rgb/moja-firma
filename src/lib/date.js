export function toLocalDateInput(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addCalendarDays(dateInput, days) {
  const [year, month, day] = String(dateInput).split('-').map(Number)
  if (![year, month, day, days].every(Number.isFinite)) return ''

  const date = new Date(Date.UTC(year, month - 1, day + Number(days)))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}
