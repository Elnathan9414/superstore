// Pure sale calculations, in integer amounts (smallest currency unit).
// The database (create_sale) recomputes everything and is authoritative;
// these functions must apply exactly the same rules so the till shows the
// same total the database will record.

export const PAYMENT_METHODS = ["cash", "mobile_money", "card", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile money",
  card: "Carte",
  transfer: "Virement",
};

export type DiscountType = "amount" | "percent";
export type Discount = { type: DiscountType; value: number } | null;

export type SaleLine = { unitPrice: number; quantity: number };
export type Payment = { method: PaymentMethod; amount: number };

export function lineTotal(line: SaleLine): number {
  return line.unitPrice * line.quantity;
}

export function subtotalOf(lines: readonly SaleLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

/**
 * Discount amount for a subtotal. Percentages are whole numbers (0-100) and
 * the result is rounded DOWN to the smallest unit. Returns null when the
 * discount is invalid (negative, above 100 %, or above the subtotal).
 */
export function discountAmount(subtotal: number, discount: Discount): number | null {
  if (!discount || discount.value === 0) return 0;
  if (!Number.isInteger(discount.value) || discount.value < 0) return null;
  if (discount.type === "amount") {
    return discount.value <= subtotal ? discount.value : null;
  }
  if (discount.value > 100) return null;
  return Math.floor((subtotal * discount.value) / 100);
}

/** Largest discount a seller may give with the configured cap (in %). */
export function maxDiscountFor(subtotal: number, capPercent: number): number {
  return Math.floor((subtotal * capPercent) / 100);
}

export type SaleTotals = {
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  /** Amount still owed (customer credit when > 0) */
  balance: number;
};

export function saleTotals(
  lines: readonly SaleLine[],
  discount: Discount,
  payments: readonly Payment[],
): SaleTotals | null {
  const subtotal = subtotalOf(lines);
  const discountValue = discountAmount(subtotal, discount);
  if (discountValue === null) return null;
  const total = subtotal - discountValue;
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return { subtotal, discount: discountValue, total, paid, balance: total - paid };
}

/** Change to give back for cash: what the customer handed over minus what is due. */
export function cashChange(handedOver: number, due: number): number {
  return Math.max(0, handedOver - due);
}

export type SaleIssue =
  | "empty_cart"
  | "invalid_discount"
  | "discount_too_high"
  | "overpayment"
  | "invalid_payment"
  | "customer_required";

/** Same checks as create_sale(), so the till can explain problems early. */
export function checkSale(input: {
  lines: readonly SaleLine[];
  discount: Discount;
  payments: readonly Payment[];
  hasCustomer: boolean;
  /** Seller discount cap in %, or null for managers/owners (no cap) */
  discountCapPercent: number | null;
}): SaleIssue | null {
  if (input.lines.length === 0) return "empty_cart";
  if (input.payments.some((p) => !Number.isSafeInteger(p.amount) || p.amount <= 0)) {
    return "invalid_payment";
  }
  const totals = saleTotals(input.lines, input.discount, input.payments);
  if (!totals) return "invalid_discount";
  if (
    input.discountCapPercent !== null &&
    totals.discount > maxDiscountFor(totals.subtotal, input.discountCapPercent)
  ) {
    return "discount_too_high";
  }
  if (totals.paid > totals.total) return "overpayment";
  if (totals.balance > 0 && !input.hasCustomer) return "customer_required";
  return null;
}

/** Receipt number shown to customers, e.g. 42 -> "V-000042". */
export function receiptNumber(saleId: number): string {
  return `V-${String(saleId).padStart(6, "0")}`;
}
