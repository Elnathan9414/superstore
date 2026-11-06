// Pure stock helpers. The stock itself is computed in the database
// (sum of stock_movements); these helpers only interpret it.

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(stock: number, minStock: number): StockLevel {
  if (stock <= 0) return "out";
  if (stock <= minStock) return "low";
  return "ok";
}

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  out: "Rupture",
  low: "Stock bas",
  ok: "En stock",
};

/** Sum of signed movement quantities (positive = in, negative = out). */
export function stockFromMovements(movements: readonly { quantity: number }[]): number {
  return movements.reduce((total, m) => total + m.quantity, 0);
}

export const MOVEMENT_TYPES = ["purchase", "sale", "return", "adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase: "Entrée",
  sale: "Vente",
  return: "Retour",
  adjustment: "Ajustement",
};

export const PRODUCT_CONDITIONS = ["new", "refurbished", "used"] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: "Neuf",
  refurbished: "Reconditionné",
  used: "Occasion",
};

/**
 * Splits pasted / scanned serial numbers (one per line, or separated by
 * commas or semicolons) into a trimmed list without empty entries.
 */
export function parseSerials(text: string): string[] {
  return text
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) duplicates.add(v);
    seen.add(v);
  }
  return [...duplicates];
}

export type SerialCheck =
  | { ok: true }
  | { ok: false; error: "count_mismatch"; expected: number; actual: number }
  | { ok: false; error: "duplicates"; duplicates: string[] };

/** A tracked product needs exactly one distinct serial per unit. */
export function checkSerials(serials: readonly string[], quantity: number): SerialCheck {
  const duplicates = findDuplicates(serials);
  if (duplicates.length > 0) return { ok: false, error: "duplicates", duplicates };
  if (serials.length !== quantity) {
    return { ok: false, error: "count_mismatch", expected: quantity, actual: serials.length };
  }
  return { ok: true };
}
