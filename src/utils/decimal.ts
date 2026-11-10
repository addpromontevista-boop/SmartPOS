/**
 * SMARTPOS Safe Decimal Financial Arithmetic Engine
 * Never uses floating-point arithmetic for monetary totals.
 * Internally represents amounts as scaled integer minor units (scale = 100 for 2-decimal currencies,
 * or 10000 for 4-decimal intermediate calculations).
 */

export type CurrencyCode = 'PHP' | 'USD';

export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  PHP: {
    code: 'PHP',
    name: 'Philippine Peso',
    symbol: '₱',
    decimals: 2,
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimals: 2,
  },
};

/**
 * Parses a decimal string or number into exact integer cents (scale 100) using string parsing.
 */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'number' ? value.toFixed(4) : String(value).trim();
  const clean = raw.replace(/[^0-9.-]/g, '');
  if (!clean || clean === '-' || clean === '.') return 0;

  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const [intPart = '0', fracPart = ''] = unsigned.split('.');

  const paddedFrac = (fracPart + '0000').slice(0, 4);
  const whole = parseInt(intPart || '0', 10) * 10000;
  const frac = parseInt(paddedFrac, 10);
  const totalScaled4 = whole + frac;

  // Round half-up from 4 decimal places to 2 decimal places (cents)
  const cents = Math.floor((totalScaled4 + 50) / 100);
  return isNegative ? -cents : cents;
}

/**
 * Converts integer cents back to a normalized DECIMAL(15,2) string (e.g., "1250.50")
 */
export function fromCents(cents: number): string {
  const rounded = Math.round(cents);
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${isNegative ? '-' : ''}${whole}.${frac}`;
}

export function addDecimal(a: string | number, b: string | number): string {
  return fromCents(toCents(a) + toCents(b));
}

export function subDecimal(a: string | number, b: string | number): string {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiplies a monetary amount by an integer or decimal quantity using exact integer math.
 */
export function mulDecimal(amount: string | number, quantity: number | string): string {
  const amountCents = toCents(amount);
  const qtyScaled = toCents(quantity); // qty * 100
  const productCents = Math.round((amountCents * qtyScaled) / 100);
  return fromCents(productCents);
}

/**
 * Calculates percentage (e.g. 12% VAT or 10% discount) using integer basis points.
 */
export function calcPercentage(amount: string | number, ratePercent: string | number): string {
  const amountCents = toCents(amount);
  const basisPoints = toCents(ratePercent); // 12.00% -> 1200 basis points
  const resultCents = Math.round((amountCents * basisPoints) / 10000);
  return fromCents(resultCents);
}

export function compareDecimal(a: string | number, b: string | number): number {
  const diff = toCents(a) - toCents(b);
  return diff === 0 ? 0 : diff > 0 ? 1 : -1;
}

export function formatMoney(amount: string | number, currency: CurrencyCode = 'PHP'): string {
  const cfg = CURRENCIES[currency] || CURRENCIES.PHP;
  const cents = toCents(amount);
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(cfg.decimals, '0');
  return `${isNegative ? '-' : ''}${cfg.symbol}${whole}.${frac}`;
}

/**
 * Converts an amount using an explicit historical or current exchange rate snapshot.
 */
export function convertWithRateSnapshot(
  amount: string | number,
  rateSnapshot: string | number
): string {
  const amountCents = toCents(amount);
  const rateScaled = toCents(rateSnapshot); // e.g. 58.50 -> 5850
  const convertedCents = Math.round((amountCents * rateScaled) / 100);
  return fromCents(convertedCents);
}
