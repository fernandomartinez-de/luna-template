// Personal settings for this copy of Luna. Change these, save, and push.

// Your first name, used in the greeting on the lock screen and the Hub.
// Leave it empty for a plain "Good morning".
export const OWNER_NAME = ''

// Money: the currency your bank uses, and how numbers are written.
// Euros written the Spanish way: 'EUR' and 'es-ES'. US dollars: 'USD' and 'en-US'.
export const CURRENCY = 'EUR'
export const MONEY_LOCALE = 'es-ES'

// Gym weights: 'kg' or 'lb'.
export const LIFT_UNIT = 'kg'
export const LIFT_STEP = LIFT_UNIT === 'kg' ? 2.5 : 5

// Short money for small tiles, e.g. 12.3K €
export function moneyCompact(n) {
  if (n == null || isNaN(n)) return '--'
  const abs = Math.abs(n)
  const sym = (0).toLocaleString(MONEY_LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 }).replace(/[\d\s., ]/g, '')
  const num = abs >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`
  return CURRENCY === 'USD' ? `${sym}${num}` : `${num} ${sym}`
}
