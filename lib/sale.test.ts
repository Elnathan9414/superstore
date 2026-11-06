import { describe, expect, it } from "vitest";
import {
  cashChange,
  checkSale,
  discountAmount,
  lineTotal,
  maxDiscountFor,
  receiptNumber,
  saleTotals,
  subtotalOf,
  type SaleLine,
} from "./sale";

const phone: SaleLine = { unitPrice: 150_000, quantity: 1 };
const cables: SaleLine = { unitPrice: 2_500, quantity: 3 };

describe("line and subtotal", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineTotal(cables)).toBe(7_500);
  });

  it("sums the lines", () => {
    expect(subtotalOf([phone, cables])).toBe(157_500);
    expect(subtotalOf([])).toBe(0);
  });
});

describe("discountAmount", () => {
  it("returns 0 without discount", () => {
    expect(discountAmount(10_000, null)).toBe(0);
    expect(discountAmount(10_000, { type: "percent", value: 0 })).toBe(0);
  });

  it("applies a fixed amount", () => {
    expect(discountAmount(10_000, { type: "amount", value: 1_500 })).toBe(1_500);
  });

  it("rounds percentages down to the smallest unit", () => {
    // 7 % of 157 500 = 11 025 exactly
    expect(discountAmount(157_500, { type: "percent", value: 7 })).toBe(11_025);
    // 10 % of 999 = 99.9 -> 99
    expect(discountAmount(999, { type: "percent", value: 10 })).toBe(99);
    // 33 % of 100 = 33
    expect(discountAmount(100, { type: "percent", value: 33 })).toBe(33);
  });

  it("allows 100 % (free sale)", () => {
    expect(discountAmount(5_000, { type: "percent", value: 100 })).toBe(5_000);
  });

  it.each([
    [{ type: "amount", value: 10_001 }],
    [{ type: "amount", value: -1 }],
    [{ type: "percent", value: 101 }],
    [{ type: "percent", value: 12.5 }],
  ] as const)("rejects %j", (discount) => {
    expect(discountAmount(10_000, discount)).toBeNull();
  });
});

describe("maxDiscountFor", () => {
  it("caps a seller discount at the configured percentage", () => {
    expect(maxDiscountFor(157_500, 10)).toBe(15_750);
    expect(maxDiscountFor(999, 10)).toBe(99);
    expect(maxDiscountFor(1_000, 0)).toBe(0);
  });
});

describe("saleTotals", () => {
  it("computes total, paid and balance", () => {
    expect(
      saleTotals([phone, cables], { type: "amount", value: 7_500 }, [
        { method: "cash", amount: 100_000 },
        { method: "mobile_money", amount: 40_000 },
      ]),
    ).toEqual({ subtotal: 157_500, discount: 7_500, total: 150_000, paid: 140_000, balance: 10_000 });
  });

  it("returns null for an invalid discount", () => {
    expect(saleTotals([cables], { type: "amount", value: 9_999 }, [])).toBeNull();
  });
});

describe("cashChange", () => {
  it("gives back the difference, never negative", () => {
    expect(cashChange(10_000, 7_500)).toBe(2_500);
    expect(cashChange(5_000, 7_500)).toBe(0);
  });
});

describe("checkSale", () => {
  const base = {
    lines: [cables],
    discount: null,
    payments: [{ method: "cash" as const, amount: 7_500 }],
    hasCustomer: false,
    discountCapPercent: 10,
  };

  it("accepts a fully paid sale", () => {
    expect(checkSale(base)).toBeNull();
  });

  it("refuses an empty cart", () => {
    expect(checkSale({ ...base, lines: [] })).toBe("empty_cart");
  });

  it("refuses paying more than the total", () => {
    expect(checkSale({ ...base, payments: [{ method: "cash", amount: 7_501 }] })).toBe("overpayment");
  });

  it("refuses zero or fractional payments", () => {
    expect(checkSale({ ...base, payments: [{ method: "cash", amount: 0 }] })).toBe("invalid_payment");
    expect(checkSale({ ...base, payments: [{ method: "cash", amount: 1.5 }] })).toBe("invalid_payment");
  });

  it("requires a customer for credit", () => {
    expect(checkSale({ ...base, payments: [{ method: "cash", amount: 5_000 }] })).toBe(
      "customer_required",
    );
    expect(
      checkSale({ ...base, payments: [{ method: "cash", amount: 5_000 }], hasCustomer: true }),
    ).toBeNull();
  });

  it("enforces the seller discount cap", () => {
    const at10 = { ...base, discount: { type: "percent" as const, value: 10 }, payments: [] , hasCustomer: true };
    expect(checkSale(at10)).toBeNull();
    expect(checkSale({ ...at10, discount: { type: "percent", value: 11 } })).toBe("discount_too_high");
    expect(checkSale({ ...at10, discount: { type: "amount", value: 751 } })).toBe("discount_too_high");
  });

  it("does not cap managers", () => {
    expect(
      checkSale({
        ...base,
        discount: { type: "percent", value: 50 },
        payments: [{ method: "cash", amount: 3_750 }],
        discountCapPercent: null,
      }),
    ).toBeNull();
  });
});

describe("receiptNumber", () => {
  it("pads the sale id", () => {
    expect(receiptNumber(42)).toBe("V-000042");
  });
});
