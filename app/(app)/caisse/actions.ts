"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGEMENT_ROLES } from "@/lib/auth/roles";
import { requireRole, requireSection } from "@/lib/auth/session";
import { searchCustomers, type CustomerLite } from "@/lib/data/sales";
import { mapDbError } from "@/lib/db-errors";
import { cleanSearch, ilikeAny } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { cancelSaleSchema, checkoutSchema, quickCustomerSchema } from "@/lib/validation/sale";
import { fieldErrors } from "@/lib/validation/form";

// ---------- Product search ----------

const posProductSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    sku: z.string(),
    barcode: z.string().nullable(),
    brand: z.string().nullable(),
    sale_price: z.number(),
    stock: z.number(),
    tracks_serial: z.boolean(),
  })
  .transform((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    brand: p.brand,
    salePrice: p.sale_price,
    stock: p.stock,
    tracksSerial: p.tracks_serial,
  }));

export type PosProduct = z.output<typeof posProductSchema>;
export type PosSerial = { id: number; serialNumber: string };

export type PosSearchResult = {
  products: PosProduct[];
  /** Exact barcode / SKU match: the till adds it to the cart directly */
  exact: PosProduct | null;
  /** Scanned IMEI / serial number of a unit in stock */
  serial: { product: PosProduct; unit: PosSerial } | null;
};

const POS_COLUMNS = "id, name, sku, barcode, brand, sale_price, stock, tracks_serial";

export async function searchPos(query: string): Promise<PosSearchResult> {
  await requireSection("pos");
  const raw = typeof query === "string" ? query.trim().slice(0, 100) : "";
  const empty: PosSearchResult = { products: [], exact: null, serial: null };
  if (!raw) return empty;

  const supabase = await createClient();
  const base = () =>
    supabase.from("product_overview").select(POS_COLUMNS).eq("is_active", true);

  // .eq() values are URL-encoded by supabase-js: safe with raw input
  const [byBarcode, bySku, bySerial] = await Promise.all([
    base().eq("barcode", raw).limit(1),
    base().eq("sku", raw).limit(1),
    supabase
      .from("serial_units")
      .select("id, serial_number, product_id")
      .eq("serial_number", raw)
      .eq("status", "in_stock")
      .limit(1),
  ]);

  const exactRow = byBarcode.data?.[0] ?? bySku.data?.[0];
  const exact = exactRow ? posProductSchema.parse(exactRow) : null;

  let serial: PosSearchResult["serial"] = null;
  const unit = bySerial.data?.[0];
  if (unit) {
    const { data } = await base().eq("id", unit.product_id).maybeSingle();
    if (data) {
      serial = {
        product: posProductSchema.parse(data),
        unit: { id: unit.id, serialNumber: unit.serial_number },
      };
    }
  }

  let products: PosProduct[] = [];
  const term = cleanSearch(raw);
  if (term) {
    const { data, error } = await base()
      .or(ilikeAny(["name", "sku", "barcode", "brand"], term))
      .order("name")
      .limit(12);
    if (error) throw new Error(`POS search failed: ${error.message}`);
    products = z.array(posProductSchema).parse(data);
  }

  return { products, exact, serial };
}

export async function listAvailableSerials(productId: number): Promise<PosSerial[]> {
  await requireSection("pos");
  const id = z.number().int().positive().safeParse(productId);
  if (!id.success) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("serial_units")
    .select("id, serial_number")
    .eq("product_id", id.data)
    .eq("status", "in_stock")
    .order("serial_number");
  if (error) throw new Error(`Failed to load serial units: ${error.message}`);
  return z
    .array(z.object({ id: z.number(), serial_number: z.string() }))
    .parse(data)
    .map((s) => ({ id: s.id, serialNumber: s.serial_number }));
}

// ---------- Customers ----------

export async function findCustomers(query: string): Promise<CustomerLite[]> {
  await requireSection("pos");
  return searchCustomers(typeof query === "string" ? query : "");
}

export type CreateCustomerResult =
  | { ok: true; customer: CustomerLite }
  | { ok: false; errors: Record<string, string | undefined> };

export async function createQuickCustomer(input: {
  fullName: string;
  phone: string;
}): Promise<CreateCustomerResult> {
  await requireSection("pos");
  const parsed = quickCustomerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .select("id, full_name, phone")
    .single();
  if (error) return { ok: false, errors: { form: mapDbError(error).message } };
  return {
    ok: true,
    customer: { id: data.id, fullName: data.full_name, phone: data.phone },
  };
}

// ---------- Checkout ----------

export type CheckoutResult =
  | { ok: true; saleId: number }
  | { ok: false; message: string; field?: string };

export async function checkout(input: unknown): Promise<CheckoutResult> {
  await requireSection("pos");
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Données de vente invalides." };
  }
  const c = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sale", {
    p_client_ref: c.clientRef,
    p_customer_id: c.customerId,
    p_items: c.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      serial_ids: i.serialIds,
    })),
    p_discount_type: c.discount?.type ?? null,
    p_discount_value: c.discount?.value ?? 0,
    p_payments: c.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference,
    })),
    p_expected_total: c.expectedTotal,
    p_notes: c.notes,
  });

  if (error) {
    const mapped = mapDbError(error);
    if (mapped.message === "L'opération a échoué. Réessayez.") {
      console.error("create_sale failed:", error);
    }
    return { ok: false, message: mapped.message, field: mapped.field };
  }

  revalidatePath("/caisse/ventes");
  revalidatePath("/stock");
  revalidatePath("/produits");
  revalidatePath("/");
  return { ok: true, saleId: Number(data) };
}

// ---------- Cancellation (managers) ----------

export async function cancelSale(input: {
  saleId: number;
  reason: string;
}): Promise<{ ok: boolean; message?: string }> {
  await requireRole(MANAGEMENT_ROLES);
  const parsed = cancelSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", {
    p_sale_id: parsed.data.saleId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    const mapped = mapDbError(error);
    if (mapped.message === "L'opération a échoué. Réessayez.") {
      console.error("cancel_sale failed:", error);
    }
    return { ok: false, message: mapped.message };
  }

  revalidatePath(`/caisse/ventes/${parsed.data.saleId}`);
  revalidatePath("/caisse/ventes");
  revalidatePath("/stock");
  revalidatePath("/produits");
  return { ok: true };
}
