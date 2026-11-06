import { describe, expect, it } from "vitest";
import { mapDbError } from "./db-errors";

describe("mapDbError", () => {
  it("maps function error codes to French messages and fields", () => {
    expect(mapDbError({ code: "P0001", message: "negative_stock" })).toEqual({
      field: "quantity",
      message: "Le stock ne peut pas devenir négatif.",
    });
  });

  it("names the product when the database provides it", () => {
    expect(
      mapDbError({ code: "P0001", message: "insufficient_stock", details: "iPhone 15" }).message,
    ).toBe("Stock insuffisant pour un article du panier. (iPhone 15)");
  });

  it("shows the discount cap", () => {
    expect(mapDbError({ code: "P0001", message: "discount_too_high", details: "10" }).message).toBe(
      "Remise supérieure au plafond autorisé (10 %).",
    );
  });

  it("lists known serial numbers", () => {
    expect(mapDbError({ code: "P0001", message: "serial_exists", details: "A1, A2" })).toEqual({
      field: "serials",
      message: "Numéro(s) de série déjà enregistré(s) : A1, A2",
    });
  });

  it("maps unique violations by constraint name", () => {
    expect(
      mapDbError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "products_sku_key"',
      }),
    ).toEqual({ field: "sku", message: "Ce SKU est déjà utilisé." });
  });

  it("falls back to a generic message without leaking details", () => {
    expect(mapDbError({ code: "XX000", message: "internal: secret stuff" }).message).toBe(
      "L'opération a échoué. Réessayez.",
    );
  });

  it("maps permission errors", () => {
    expect(mapDbError({ code: "42501", message: "forbidden" }).message).toBe(
      "Action réservée aux gérants et au propriétaire.",
    );
    expect(mapDbError({ code: "42501", message: "new row violates row-level security" }).message).toBe(
      "Vous n'avez pas les droits pour cette action.",
    );
  });
});
