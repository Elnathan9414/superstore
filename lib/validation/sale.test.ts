import { describe, expect, it } from "vitest";
import { cancelSaleSchema, checkoutSchema, quickCustomerSchema, settingsSchema } from "./sale";

const checkout = {
  clientRef: "3f2b8c1e-7a4d-4e8b-9c1a-2b3c4d5e6f70",
  customerId: null,
  items: [{ productId: 1, quantity: 2, serialIds: [] }],
  discount: null,
  payments: [{ method: "cash", amount: 5000, reference: null }],
  expectedTotal: 5000,
  notes: null,
};

describe("checkoutSchema", () => {
  it("accepts a valid checkout", () => {
    expect(checkoutSchema.safeParse(checkout).success).toBe(true);
  });

  it.each([
    ["empty cart", { items: [] }],
    ["fractional amount", { payments: [{ method: "cash", amount: 10.5, reference: null }] }],
    ["unknown method", { payments: [{ method: "cheque", amount: 10, reference: null }] }],
    ["zero payment", { payments: [{ method: "cash", amount: 0, reference: null }] }],
    ["negative discount", { discount: { type: "amount", value: -5 } }],
    ["bad client ref", { clientRef: "123" }],
    ["fractional quantity", { items: [{ productId: 1, quantity: 1.5, serialIds: [] }] }],
  ])("rejects %s", (_label, patch) => {
    expect(checkoutSchema.safeParse({ ...checkout, ...patch }).success).toBe(false);
  });
});

describe("quickCustomerSchema", () => {
  it("accepts a name with an optional phone", () => {
    expect(quickCustomerSchema.parse({ fullName: " Paul Mbarga ", phone: "" })).toEqual({
      fullName: "Paul Mbarga",
      phone: null,
    });
    expect(quickCustomerSchema.parse({ fullName: "Paul", phone: "+237 6 99 00 11 22" }).phone).toBe(
      "+237 6 99 00 11 22",
    );
  });

  it("rejects letters in the phone", () => {
    expect(quickCustomerSchema.safeParse({ fullName: "Paul", phone: "abc" }).success).toBe(false);
  });
});

describe("cancelSaleSchema", () => {
  it("requires a reason", () => {
    expect(cancelSaleSchema.safeParse({ saleId: 1, reason: " " }).success).toBe(false);
    expect(cancelSaleSchema.safeParse({ saleId: 1, reason: "Erreur de caisse" }).success).toBe(true);
  });
});

describe("settingsSchema", () => {
  it("parses the discount cap", () => {
    expect(
      settingsSchema.parse({ shopName: "Ma Boutique", sellerMaxDiscountPercent: "15" })
        .sellerMaxDiscountPercent,
    ).toBe(15);
    expect(
      settingsSchema.safeParse({ shopName: "Ma Boutique", sellerMaxDiscountPercent: "150" }).success,
    ).toBe(false);
  });
});
