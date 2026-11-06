// Money helpers. Amounts are integers in the smallest currency unit
// (XAF: 1 franc, EUR: 1 cent). Parsing never goes through floating point.

export type Currency = {
  code: string;
  decimals: number;
};

export const DEFAULT_CURRENCY: Currency = { code: "XAF", decimals: 0 };

// Regular, no-break and narrow no-break spaces (fr-FR grouping)
const SPACES = /[\s  ]/g;

/**
 * Parses user input into an integer amount in the smallest unit.
 * Accepts "150000", "150 000", "150.000" / "150,000" (grouping, when the
 * currency has no decimals), "12,50" / "12.5" (when it has decimals).
 * Returns null for anything else (negative, too many decimals, letters...).
 */
export function parseMoney(input: string, decimals: number): number | null {
  const raw = input.trim();
  if (raw === "") return null;

  let integerPart: string;
  let fractionPart = "";

  if (decimals === 0) {
    const compact = raw.replace(SPACES, "");
    if (/^\d+$/.test(compact)) {
      integerPart = compact;
    } else if (/^\d{1,3}([.,]\d{3})+$/.test(compact)) {
      integerPart = compact.replace(/[.,]/g, "");
    } else {
      return null;
    }
  } else {
    const compact = raw.replace(SPACES, "");
    const match = /^(\d+)(?:[.,](\d*))?$/.exec(compact);
    if (!match) return null;
    integerPart = match[1];
    fractionPart = match[2] ?? "";
    if (fractionPart.length > decimals) return null;
  }

  const digits = integerPart + fractionPart.padEnd(decimals, "0");
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** Formats an integer amount for display, e.g. 150000 XAF -> "150 000 FCFA". */
export function formatMoney(amount: number, currency: Currency): string {
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });
  // Display only: the division is never stored or used in calculations.
  return formatter.format(amount / 10 ** currency.decimals);
}

/** Integer amount -> plain editable string ("150000", "12,50"). */
export function moneyToInput(amount: number, decimals: number): string {
  if (decimals === 0) return String(amount);
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(amount)).padStart(decimals + 1, "0");
  return `${sign}${digits.slice(0, -decimals)},${digits.slice(-decimals)}`;
}

/** Display symbol of a currency in French, e.g. XAF -> "FCFA", EUR -> "€". */
export function currencyLabel(currency: Currency): string {
  const part = new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.code })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currency.code;
}
