import { describe, expect, it } from "vitest";
import { fieldErrors } from "./form";
import { categorySchema, productSchema, stockAdjustmentSchema, stockEntrySchema } from "./products";

const schema = productSchema(0);
const valid = {
  sku: "IPH15-128-NOIR",
  barcode: "0194253401234",
  name: " iPhone 15 128 Go ",
  brand: "Apple",
  categoryId: "3",
  description: "",
  condition: "new",
  costPrice: "450 000",
  salePrice: "520.000",
  tracksSerial: "on",
  warrantyMonths: "12",
  minStock: "2",
};

describe("productSchema", () => {
  it("parses a valid product into typed values", () => {
    expect(schema.parse(valid)).toEqual({
      sku: "IPH15-128-NOIR",
      barcode: "0194253401234",
      name: "iPhone 15 128 Go",
      brand: "Apple",
      categoryId: 3,
      description: null,
      condition: "new",
      costPrice: 450000,
      salePrice: 520000,
      tracksSerial: true,
      warrantyMonths: 12,
      minStock: 2,
    });
  });

  it("treats optional fields as null and an unchecked box as false", () => {
    const result = schema.parse({
      ...valid,
      barcode: "",
      brand: "",
      categoryId: "none",
      tracksSerial: undefined,
    });
    expect(result.barcode).toBeNull();
    expect(result.brand).toBeNull();
    expect(result.categoryId).toBeNull();
    expect(result.tracksSerial).toBe(false);
  });

  it("reports invalid amounts and numbers per field", () => {
    const result = schema.safeParse({
      ...valid,
      sku: "avec espace",
      costPrice: "abc",
      salePrice: "",
      minStock: "-1",
      warrantyMonths: "1.5",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(
        ["costPrice", "minStock", "salePrice", "sku", "warrantyMonths"].sort(),
      );
    }
  });

  it("uses the currency decimals", () => {
    expect(productSchema(2).parse({ ...valid, costPrice: "12,50", salePrice: "15" })).toMatchObject({
      costPrice: 1250,
      salePrice: 1500,
    });
  });
});

describe("categorySchema", () => {
  it("trims and requires a name", () => {
    expect(categorySchema.parse({ name: "  Téléphones " }).name).toBe("Téléphones");
    expect(categorySchema.safeParse({ name: " " }).success).toBe(false);
  });
});

describe("stockEntrySchema", () => {
  it("parses quantity and serial list", () => {
    expect(
      stockEntrySchema.parse({ productId: "7", quantity: "2", serials: "A1\nA2\n", reason: "" }),
    ).toEqual({ productId: 7, quantity: 2, serials: ["A1", "A2"], reason: null });
  });

  it("rejects zero or negative quantities", () => {
    expect(stockEntrySchema.safeParse({ productId: "7", quantity: "0" }).success).toBe(false);
    expect(stockEntrySchema.safeParse({ productId: "7", quantity: "-3" }).success).toBe(false);
  });
});

describe("stockAdjustmentSchema", () => {
  it("requires a reason", () => {
    const result = stockAdjustmentSchema.safeParse({
      productId: "7",
      direction: "out",
      quantity: "1",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("parses selected unit ids", () => {
    expect(
      stockAdjustmentSchema.parse({
        productId: "7",
        direction: "out",
        quantity: "2",
        serialIds: ["10", "11"],
        reason: "Casse",
      }),
    ).toMatchObject({ direction: "out", quantity: 2, serialIds: [10, 11], serials: [] });
  });
});
