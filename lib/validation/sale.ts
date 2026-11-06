import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/sale";

const MAX_AMOUNT = Number.MAX_SAFE_INTEGER;
const id = z.number().int().positive();

export const checkoutSchema = z.object({
  clientRef: z.uuid(),
  customerId: id.nullable(),
  items: z
    .array(
      z.object({
        productId: id,
        quantity: z.number().int().positive().max(10_000),
        serialIds: z.array(id).max(10_000),
      }),
    )
    .min(1, { error: "Le panier est vide." })
    .max(200, { error: "Trop d'articles dans le panier." }),
  discount: z
    .object({
      type: z.enum(["amount", "percent"]),
      value: z.number().int().min(0).max(MAX_AMOUNT),
    })
    .nullable(),
  payments: z
    .array(
      z.object({
        method: z.enum(PAYMENT_METHODS),
        amount: z.number().int().positive().max(MAX_AMOUNT),
        reference: z.string().trim().max(100).nullable(),
      }),
    )
    .max(10),
  expectedTotal: z.number().int().min(0).max(MAX_AMOUNT),
  notes: z.string().trim().max(500).nullable(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

export const quickCustomerSchema = z.object({
  fullName: z
    .string({ error: "Le nom est obligatoire." })
    .trim()
    .min(2, { error: "Le nom doit contenir au moins 2 caractères." })
    .max(100, { error: "Le nom est trop long." }),
  phone: z
    .string()
    .trim()
    .max(30, { error: "Numéro trop long." })
    .regex(/^[+0-9 ().-]*$/, { error: "Numéro de téléphone invalide." })
    .optional()
    .transform((v) => (v ? v : null)),
});

export const cancelSaleSchema = z.object({
  saleId: id,
  reason: z
    .string({ error: "Le motif est obligatoire." })
    .trim()
    .min(3, { error: "Le motif est obligatoire (3 caractères minimum)." })
    .max(200, { error: "Le motif est trop long." }),
});

export const settingsSchema = z.object({
  shopName: z
    .string({ error: "Le nom est obligatoire." })
    .trim()
    .min(2, { error: "Le nom doit contenir au moins 2 caractères." })
    .max(80, { error: "Le nom est trop long." }),
  shopAddress: z
    .string()
    .trim()
    .max(200, { error: "L'adresse est trop longue." })
    .optional()
    .transform((v) => (v ? v : null)),
  shopPhone: z
    .string()
    .trim()
    .max(60, { error: "Le téléphone est trop long." })
    .optional()
    .transform((v) => (v ? v : null)),
  receiptFooter: z
    .string()
    .trim()
    .max(200, { error: "Le message est trop long." })
    .optional()
    .transform((v) => (v ? v : null)),
  sellerMaxDiscountPercent: z
    .string({ error: "Le plafond est obligatoire." })
    .trim()
    .regex(/^\d+$/, { error: "Entrez un nombre entier." })
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(0, { error: "Entre 0 et 100." })
        .max(100, { error: "Entre 0 et 100." }),
    ),
});
