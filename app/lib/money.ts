/**
 * Money handling for rate, deposit, and balance amounts.
 *
 * Amounts are stored as display strings ("$1,200") rather than numbers, so
 * every read has to parse and every write has to format. These helpers are the
 * single place that happens.
 *
 * Everything is whole dollars — the venue has never billed cents, and the
 * QuickBooks invoices are built from these same values.
 */

/** Fraction of the rate used as the default deposit. */
export const DEPOSIT_RATIO = 0.5

/**
 * Pull a number out of a stored amount. "$1,200" -> 1200.
 * Anything without digits (empty, "TBD", undefined) -> 0.
 */
export function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Math.round(value)
  if (!value) return 0
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return 0
  return parseInt(digits, 10)
}

/**
 * Format an amount for display. 1200 and "$1,200" both -> "$1,200".
 *
 * Non-numeric text is passed through unchanged rather than blanked, so legacy
 * free-text values survive on screen — some of the imported 2021 bookings have
 * things like "TBD" where a rate should be, and silently rendering those as
 * empty would look like missing data.
 */
export function formatCurrency(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') return '$' + Math.round(value).toLocaleString('en-US')
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return value
  return '$' + parseInt(digits, 10).toLocaleString('en-US')
}

/**
 * Format keystrokes inside a currency input.
 *
 * Unlike formatCurrency this returns "" for input with no digits, so
 * backspacing through the field actually clears it instead of leaving stray
 * characters behind.
 */
export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return ''
  return '$' + parseInt(digits, 10).toLocaleString('en-US')
}

/**
 * Balance still owed after the deposit. Returns "—" when there is nothing
 * meaningful to show, which is what every call site wants to render.
 */
export function formatBalanceDue(
  rate: string | number | null | undefined,
  deposit: string | number | null | undefined,
): string {
  const balance = parseAmount(rate) - parseAmount(deposit)
  return balance > 0 ? formatCurrency(balance) : '—'
}

/**
 * The deposit we'd charge for a given rate — half, rounded to whole dollars.
 * Returns "" for a rate with no numeric value, so an empty rate doesn't
 * produce a $0 deposit.
 */
export function defaultDeposit(rate: string | number | null | undefined): string {
  const amount = parseAmount(rate)
  if (amount <= 0) return ''
  return formatCurrency(Math.round(amount * DEPOSIT_RATIO))
}
