/**
 * Money handling.
 *
 * Everything in this app stores money as a whole number of cents. Computers
 * get 0.1 + 0.2 slightly wrong, and a budget app that's a cent out is a broken
 * demo. Convert to dollars only at the moment of display.
 */

/** 129900 -> "$1,299.00" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100)
}

/** 1299.0 (from the catalogue or API) -> 129900 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/** 129900 -> 1299.0, for sending to an API that speaks dollars */
export function centsToDollars(cents: number): number {
  return cents / 100
}
