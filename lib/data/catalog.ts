import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CURRENCY, type Currency } from "@/lib/money";
import { MOVEMENT_TYPES, PRODUCT_CONDITIONS, type MovementType } from "@/lib/stock";
import { cleanSearch, ilikeAny } from "@/lib/search";

// All reads use the signed-in user's client, so RLS applies. Rows are
// validated with zod because the Supabase client is untyped here.

export const PAGE_SIZE = 25;

// ---------- Settings ----------

export const getCurrency = cache(async (): Promise<Currency> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_settings")
    .select("currency_code, currency_decimals")
    .maybeSingle();
  if (!data) return DEFAULT_CURRENCY;
  return { code: data.currency_code, decimals: data.currency_decimals };
});

// ---------- Categories ----------

const categorySchema = z.object({ id: z.number(), name: z.string() });
export type Category = z.infer<typeof categorySchema>;

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name").order("name");
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return z.array(categorySchema).parse(data);
}

export async function listCategoriesWithCounts(): Promise<(Category & { productCount: number })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, products(count)")
    .order("name");
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return z
    .array(
      categorySchema.extend({ products: z.array(z.object({ count: z.number() })) }),
    )
    .parse(data)
    .map(({ products, ...c }) => ({ ...c, productCount: products[0]?.count ?? 0 }));
}

// ---------- Products ----------

const PRODUCT_COLUMNS =
  "id, sku, barcode, name, brand, category_id, category_name, description, condition, sale_price, tracks_serial, warranty_months, min_stock, is_active, stock, is_low_stock";

const productRowSchema = z
  .object({
    id: z.number(),
    sku: z.string(),
    barcode: z.string().nullable(),
    name: z.string(),
    brand: z.string().nullable(),
    category_id: z.number().nullable(),
    category_name: z.string().nullable(),
    description: z.string().nullable(),
    condition: z.enum(PRODUCT_CONDITIONS),
    sale_price: z.number(),
    tracks_serial: z.boolean(),
    warranty_months: z.number(),
    min_stock: z.number(),
    is_active: z.boolean(),
    stock: z.number(),
    is_low_stock: z.boolean(),
  })
  .transform((r) => ({
    id: r.id,
    sku: r.sku,
    barcode: r.barcode,
    name: r.name,
    brand: r.brand,
    categoryId: r.category_id,
    categoryName: r.category_name,
    description: r.description,
    condition: r.condition,
    salePrice: r.sale_price,
    tracksSerial: r.tracks_serial,
    warrantyMonths: r.warranty_months,
    minStock: r.min_stock,
    isActive: r.is_active,
    stock: r.stock,
    isLowStock: r.is_low_stock,
  }));

export type Product = z.output<typeof productRowSchema>;

export type ProductFilters = {
  q?: string;
  categoryId?: number;
  lowStock?: boolean;
  archived?: boolean;
  page?: number;
};

export async function listProducts(
  filters: ProductFilters,
): Promise<{ rows: Product[]; total: number }> {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("product_overview")
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .eq("is_active", !filters.archived)
    .order("name")
    .range(from, from + PAGE_SIZE - 1);

  const term = cleanSearch(filters.q);
  if (term) query = query.or(ilikeAny(["name", "sku", "barcode", "brand"], term));
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.lowStock) query = query.eq("is_low_stock", true);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  return { rows: z.array(productRowSchema).parse(data), total: count ?? 0 };
}

export async function getProduct(id: number): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_overview")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load product: ${error.message}`);
  return data ? productRowSchema.parse(data) : null;
}

/** Purchase price. RLS returns nothing to sellers, so callers get null. */
export async function getProductCost(id: number): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_costs")
    .select("cost_price")
    .eq("product_id", id)
    .maybeSingle();
  return data ? z.number().parse(data.cost_price) : null;
}

export async function countLowStock(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("product_overview")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_low_stock", true);
  if (error) throw new Error(`Failed to count low stock: ${error.message}`);
  return count ?? 0;
}

// ---------- Serial units ----------

const serialSchema = z
  .object({ id: z.number(), serial_number: z.string(), created_at: z.string() })
  .transform((r) => ({ id: r.id, serialNumber: r.serial_number, createdAt: r.created_at }));

export type SerialUnit = z.output<typeof serialSchema>;

export async function listSerialsInStock(productId: number): Promise<SerialUnit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("serial_units")
    .select("id, serial_number, created_at")
    .eq("product_id", productId)
    .eq("status", "in_stock")
    .order("created_at");
  if (error) throw new Error(`Failed to load serial units: ${error.message}`);
  return z.array(serialSchema).parse(data);
}

// ---------- Stock movements ----------

const movementSchema = z
  .object({
    id: z.number(),
    product_id: z.number(),
    product_name: z.string(),
    product_sku: z.string(),
    quantity: z.number(),
    type: z.enum(MOVEMENT_TYPES),
    reason: z.string().nullable(),
    created_by_name: z.string().nullable(),
    created_at: z.string(),
  })
  .transform((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    productSku: r.product_sku,
    quantity: r.quantity,
    type: r.type,
    reason: r.reason,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  }));

export type Movement = z.output<typeof movementSchema>;

export type MovementFilters = {
  productId?: number;
  q?: string;
  type?: MovementType;
  /** Inclusive, YYYY-MM-DD (shop local day boundaries handled by caller) */
  fromIso?: string;
  toIso?: string;
  page?: number;
  pageSize?: number;
};

export async function listMovements(
  filters: MovementFilters,
): Promise<{ rows: Movement[]; total: number }> {
  const supabase = await createClient();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const from = ((filters.page ?? 1) - 1) * pageSize;

  let query = supabase
    .from("stock_movement_history")
    .select(
      "id, product_id, product_name, product_sku, quantity, type, reason, created_by_name, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.fromIso) query = query.gte("created_at", filters.fromIso);
  if (filters.toIso) query = query.lt("created_at", filters.toIso);
  const term = cleanSearch(filters.q);
  if (term) query = query.or(ilikeAny(["product_name", "product_sku"], term));

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load movements: ${error.message}`);
  return { rows: z.array(movementSchema).parse(data), total: count ?? 0 };
}
