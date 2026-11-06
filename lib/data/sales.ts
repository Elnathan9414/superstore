import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHODS } from "@/lib/sale";
import { cleanSearch, ilikeAny } from "@/lib/search";

// Reads use the signed-in user's client: RLS applies. sale_item_costs is
// only readable by managers/owners, so sellers get null costs.

export const SALES_PAGE_SIZE = 25;

const saleRowSchema = z
  .object({
    id: z.number(),
    created_at: z.string(),
    status: z.enum(["completed", "cancelled"]),
    subtotal: z.number(),
    discount: z.number(),
    total: z.number(),
    paid: z.number(),
    balance: z.number(),
    seller_id: z.string(),
    seller_name: z.string().nullable(),
    customer_id: z.number().nullable(),
    customer_name: z.string().nullable(),
    customer_phone: z.string().nullable(),
    item_count: z.number(),
    notes: z.string().nullable(),
    cancelled_at: z.string().nullable(),
    cancelled_by_name: z.string().nullable(),
    cancel_reason: z.string().nullable(),
  })
  .transform((r) => ({
    id: r.id,
    createdAt: r.created_at,
    status: r.status,
    subtotal: r.subtotal,
    discount: r.discount,
    total: r.total,
    paid: r.paid,
    balance: r.balance,
    sellerId: r.seller_id,
    sellerName: r.seller_name,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    itemCount: r.item_count,
    notes: r.notes,
    cancelledAt: r.cancelled_at,
    cancelledByName: r.cancelled_by_name,
    cancelReason: r.cancel_reason,
  }));

export type SaleSummary = z.output<typeof saleRowSchema>;

const SALE_COLUMNS =
  "id, created_at, status, subtotal, discount, total, paid, balance, seller_id, seller_name, customer_id, customer_name, customer_phone, item_count, notes, cancelled_at, cancelled_by_name, cancel_reason";

export type SaleFilters = {
  fromIso?: string;
  toIso?: string;
  status?: "completed" | "cancelled";
  unpaidOnly?: boolean;
  page?: number;
};

export async function listSales(
  filters: SaleFilters,
): Promise<{ rows: SaleSummary[]; total: number }> {
  const supabase = await createClient();
  const from = ((filters.page ?? 1) - 1) * SALES_PAGE_SIZE;
  let query = supabase
    .from("sale_overview")
    .select(SALE_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + SALES_PAGE_SIZE - 1);

  if (filters.fromIso) query = query.gte("created_at", filters.fromIso);
  if (filters.toIso) query = query.lt("created_at", filters.toIso);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.unpaidOnly) query = query.gt("balance", 0).eq("status", "completed");

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load sales: ${error.message}`);
  return { rows: z.array(saleRowSchema).parse(data), total: count ?? 0 };
}

const itemSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  quantity: z.number(),
  unit_price: z.number(),
  products: z.object({ name: z.string(), sku: z.string(), warranty_months: z.number() }),
  serial_units: z.array(
    z.object({ serial_number: z.string(), warranty_ends_at: z.string().nullable() }),
  ),
});

const paymentSchema = z.object({
  id: z.number(),
  method: z.enum(PAYMENT_METHODS),
  amount: z.number(),
  reference: z.string().nullable(),
  created_at: z.string(),
});

export type SaleDetail = SaleSummary & {
  items: {
    id: number;
    productId: number;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    warrantyMonths: number;
    serials: { serialNumber: string; warrantyEndsAt: string | null }[];
    /** null for sellers (RLS) */
    unitCost: number | null;
  }[];
  payments: z.output<typeof paymentSchema>[];
};

export async function getSale(id: number): Promise<SaleDetail | null> {
  const supabase = await createClient();
  const [saleRes, itemsRes, paymentsRes] = await Promise.all([
    supabase.from("sale_overview").select(SALE_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("sale_items")
      .select(
        "id, product_id, quantity, unit_price, products(name, sku, warranty_months), serial_units(serial_number, warranty_ends_at)",
      )
      .eq("sale_id", id)
      .order("id"),
    supabase
      .from("payments")
      .select("id, method, amount, reference, created_at")
      .eq("sale_id", id)
      .order("id"),
  ]);

  if (saleRes.error) throw new Error(`Failed to load sale: ${saleRes.error.message}`);
  if (!saleRes.data) return null;
  if (itemsRes.error) throw new Error(`Failed to load sale items: ${itemsRes.error.message}`);
  if (paymentsRes.error) throw new Error(`Failed to load payments: ${paymentsRes.error.message}`);

  const items = z.array(itemSchema).parse(itemsRes.data);

  // Costs: empty for sellers because of RLS
  const costs = new Map<number, number>();
  if (items.length > 0) {
    const { data } = await supabase
      .from("sale_item_costs")
      .select("sale_item_id, unit_cost")
      .in(
        "sale_item_id",
        items.map((i) => i.id),
      );
    for (const row of z
      .array(z.object({ sale_item_id: z.number(), unit_cost: z.number() }))
      .parse(data ?? [])) {
      costs.set(row.sale_item_id, row.unit_cost);
    }
  }

  return {
    ...saleRowSchema.parse(saleRes.data),
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.products.name,
      sku: i.products.sku,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      warrantyMonths: i.products.warranty_months,
      serials: i.serial_units.map((s) => ({
        serialNumber: s.serial_number,
        warrantyEndsAt: s.warranty_ends_at,
      })),
      unitCost: costs.get(i.id) ?? null,
    })),
    payments: z.array(paymentSchema).parse(paymentsRes.data),
  };
}

// ---------- Customers (quick lookup at the till) ----------

const customerSchema = z
  .object({ id: z.number(), full_name: z.string(), phone: z.string().nullable() })
  .transform((c) => ({ id: c.id, fullName: c.full_name, phone: c.phone }));

export type CustomerLite = z.output<typeof customerSchema>;

export async function searchCustomers(q: string): Promise<CustomerLite[]> {
  const term = cleanSearch(q);
  if (!term) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .or(ilikeAny(["full_name", "phone"], term))
    .order("full_name")
    .limit(10);
  if (error) throw new Error(`Failed to search customers: ${error.message}`);
  return z.array(customerSchema).parse(data);
}
