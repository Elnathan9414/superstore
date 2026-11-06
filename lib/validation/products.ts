import { z } from "zod";
import { parseMoney } from "@/lib/money";
import { PRODUCT_CONDITIONS, parseSerials } from "@/lib/stock";

const MAX_QUANTITY = 10_000;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} est trop long.` })
    .optional()
    .transform((v) => (v ? v : null));

/** Money field: user text -> integer in the smallest currency unit. */
const money = (decimals: number, label: string) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .min(1, { error: `${label} est obligatoire.` })
    .transform((value, ctx) => {
      const parsed = parseMoney(value, decimals);
      if (parsed === null) {
        ctx.addIssue({ code: "custom", message: `${label} : montant invalide.` });
        return z.NEVER;
      }
      return parsed;
    });

const wholeNumber = (label: string, { min = 0, max = MAX_QUANTITY } = {}) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .regex(/^-?\d+$/, { error: `${label} doit être un nombre entier.` })
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(min, { error: `${label} doit être au moins ${min}.` })
        .max(max, { error: `${label} doit être au plus ${max}.` }),
    );

const id = z
  .string()
  .regex(/^\d+$/, { error: "Identifiant invalide." })
  .transform(Number)
  .pipe(z.number().int().positive());

export function productSchema(decimals: number) {
  return z.object({
    sku: z
      .string({ error: "Le SKU est obligatoire." })
      .trim()
      .min(1, { error: "Le SKU est obligatoire." })
      .max(50, { error: "Le SKU est trop long." })
      .regex(/^[A-Za-z0-9._\-/]+$/, {
        error: "Le SKU ne peut contenir que lettres, chiffres, . _ - /",
      }),
    barcode: z
      .string()
      .trim()
      .max(50, { error: "Le code-barres est trop long." })
      .regex(/^[A-Za-z0-9\-]*$/, { error: "Code-barres invalide." })
      .optional()
      .transform((v) => (v ? v : null)),
    name: z
      .string({ error: "Le nom est obligatoire." })
      .trim()
      .min(2, { error: "Le nom doit contenir au moins 2 caractères." })
      .max(150, { error: "Le nom est trop long." }),
    brand: optionalText(60, "La marque"),
    categoryId: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v || v === "none") return null;
        if (!/^\d+$/.test(v)) {
          ctx.addIssue({ code: "custom", message: "Catégorie invalide." });
          return z.NEVER;
        }
        return Number(v);
      }),
    description: optionalText(1000, "La description"),
    condition: z.enum(PRODUCT_CONDITIONS, { error: "État invalide." }),
    costPrice: money(decimals, "Le prix d'achat"),
    salePrice: money(decimals, "Le prix de vente"),
    tracksSerial: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    warrantyMonths: wholeNumber("La garantie", { max: 120 }),
    minStock: wholeNumber("Le stock minimum"),
  });
}

export type ProductInput = z.output<ReturnType<typeof productSchema>>;

export const categorySchema = z.object({
  name: z
    .string({ error: "Le nom est obligatoire." })
    .trim()
    .min(2, { error: "Le nom doit contenir au moins 2 caractères." })
    .max(60, { error: "Le nom est trop long." }),
});

export const idSchema = id;

const serialsText = z
  .string()
  .optional()
  .transform((v) => parseSerials(v ?? ""));

export const stockEntrySchema = z.object({
  productId: id,
  quantity: wholeNumber("La quantité", { min: 1 }),
  serials: serialsText,
  reason: optionalText(200, "La note"),
});

export const stockAdjustmentSchema = z.object({
  productId: id,
  direction: z.enum(["in", "out"], { error: "Choisissez une entrée ou une sortie." }),
  quantity: wholeNumber("La quantité", { min: 1 }),
  serials: serialsText,
  serialIds: z.array(id).default([]),
  reason: z
    .string({ error: "Le motif est obligatoire." })
    .trim()
    .min(3, { error: "Le motif est obligatoire (3 caractères minimum)." })
    .max(200, { error: "Le motif est trop long." }),
});
