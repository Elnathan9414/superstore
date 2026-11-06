"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MANAGEMENT_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { getCurrency } from "@/lib/data/catalog";
import { mapDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formValues, type FormState } from "@/lib/validation/form";
import { idSchema, productSchema } from "@/lib/validation/products";

const PRODUCT_FIELDS = [
  "sku",
  "barcode",
  "name",
  "brand",
  "categoryId",
  "description",
  "condition",
  "costPrice",
  "salePrice",
  "tracksSerial",
  "warrantyMonths",
  "minStock",
] as const;

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(MANAGEMENT_ROLES);

  const rawId = formData.get("productId");
  const productId = typeof rawId === "string" && rawId ? idSchema.safeParse(rawId) : null;
  if (productId && !productId.success) return { message: "Produit invalide." };

  const values = formValues(formData, PRODUCT_FIELDS);
  const { decimals } = await getCurrency();
  const parsed = productSchema(decimals).safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const p = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_product", {
    p_id: productId?.data ?? null,
    p_sku: p.sku,
    p_barcode: p.barcode,
    p_name: p.name,
    p_brand: p.brand,
    p_category_id: p.categoryId,
    p_description: p.description,
    p_condition: p.condition,
    p_sale_price: p.salePrice,
    p_cost_price: p.costPrice,
    p_tracks_serial: p.tracksSerial,
    p_warranty_months: p.warrantyMonths,
    p_min_stock: p.minStock,
  });

  if (error) {
    const mapped = mapDbError(error);
    if (mapped.message === "L'opération a échoué. Réessayez.") {
      console.error("save_product failed:", error);
    }
    return mapped.field
      ? { errors: { [mapped.field]: mapped.message }, values }
      : { message: mapped.message, values };
  }

  const savedId = Number(data);
  revalidatePath("/produits");
  revalidatePath("/stock");
  redirect(`/produits/${savedId}`);
}

export async function setProductActive(input: {
  productId: number;
  active: boolean;
}): Promise<FormState> {
  await requireRole(MANAGEMENT_ROLES);
  const productId = idSchema.safeParse(String(input.productId));
  if (!productId.success || typeof input.active !== "boolean") {
    return { message: "Données invalides." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: input.active })
    .eq("id", productId.data)
    .select("id");

  if (error) return { message: mapDbError(error).message };
  if (!data?.length) return { message: "Produit introuvable." };

  revalidatePath("/produits");
  revalidatePath(`/produits/${productId.data}`);
  revalidatePath("/stock");
  return { ok: true };
}
