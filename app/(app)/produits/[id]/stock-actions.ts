"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MANAGEMENT_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { getProduct } from "@/lib/data/catalog";
import { mapDbError } from "@/lib/db-errors";
import { checkSerials } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formValues, type FormState } from "@/lib/validation/form";
import { stockAdjustmentSchema, stockEntrySchema } from "@/lib/validation/products";

function serialMessage(check: ReturnType<typeof checkSerials>): string | undefined {
  if (check.ok) return undefined;
  if (check.error === "duplicates") {
    return `Numéro(s) saisi(s) plusieurs fois : ${check.duplicates.join(", ")}`;
  }
  return `Il faut ${check.expected} numéro(s) de série, ${check.actual} saisi(s).`;
}

function dbFailure(error: { code?: string; message?: string; details?: string }, values: FormState["values"]): FormState {
  const mapped = mapDbError(error);
  if (mapped.message === "L'opération a échoué. Réessayez.") {
    console.error("Stock operation failed:", error);
  }
  return mapped.field
    ? { errors: { [mapped.field]: mapped.message }, values }
    : { message: mapped.message, values };
}

function done(productId: number): never {
  revalidatePath(`/produits/${productId}`);
  revalidatePath("/produits");
  revalidatePath("/stock");
  revalidatePath("/stock/mouvements");
  redirect(`/produits/${productId}`);
}

export async function recordStockEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(MANAGEMENT_ROLES);
  const values = formValues(formData, ["productId", "quantity", "serials", "reason"]);
  const parsed = stockEntrySchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const { productId, quantity, serials, reason } = parsed.data;
  const product = await getProduct(productId);
  if (!product) return { message: "Produit introuvable.", values };

  // Early, friendly checks; the database function re-checks everything.
  if (product.tracksSerial) {
    const message = serialMessage(checkSerials(serials, quantity));
    if (message) return { errors: { serials: message }, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("stock_entry", {
    p_product_id: productId,
    p_quantity: quantity,
    p_serials: product.tracksSerial ? serials : [],
    p_reason: reason,
  });
  if (error) return dbFailure(error, values);

  done(productId);
}

export async function recordStockAdjustment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(MANAGEMENT_ROLES);
  const values = formValues(formData, ["productId", "direction", "quantity", "serials", "reason"]);
  const serialIds = formData.getAll("serialIds").filter((v) => typeof v === "string");
  const parsed = stockAdjustmentSchema.safeParse({ ...values, serialIds });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const { productId, direction, serials, reason } = parsed.data;
  const product = await getProduct(productId);
  if (!product) return { message: "Produit introuvable.", values };

  // For tracked products leaving stock, the quantity is the number of units picked
  const quantity =
    product.tracksSerial && direction === "out" ? parsed.data.serialIds.length : parsed.data.quantity;
  const delta = direction === "in" ? quantity : -quantity;

  if (product.tracksSerial) {
    if (direction === "in") {
      const message = serialMessage(checkSerials(serials, quantity));
      if (message) return { errors: { serials: message }, values };
    } else if (quantity === 0) {
      return { errors: { serialIds: "Sélectionnez les unités qui sortent du stock." }, values };
    }
  }
  if (product.stock + delta < 0) {
    return {
      errors: { quantity: `Stock insuffisant : ${product.stock} en stock.` },
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("stock_adjustment", {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_serial_ids: product.tracksSerial && direction === "out" ? parsed.data.serialIds : [],
    p_serials: product.tracksSerial && direction === "in" ? serials : [],
  });
  if (error) return dbFailure(error, values);

  done(productId);
}
