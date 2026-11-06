import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CURRENCY, type Currency } from "@/lib/money";

const settingsSchema = z.object({
  shop_name: z.string(),
  shop_address: z.string().nullable(),
  shop_phone: z.string().nullable(),
  receipt_footer: z.string().nullable(),
  currency_code: z.string(),
  currency_decimals: z.number(),
  seller_max_discount_percent: z.number(),
});

export type ShopSettings = {
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  receiptFooter: string | null;
  currency: Currency;
  sellerMaxDiscountPercent: number;
};

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "Boutique",
  shopAddress: null,
  shopPhone: null,
  receiptFooter: null,
  currency: DEFAULT_CURRENCY,
  sellerMaxDiscountPercent: 10,
};

/** Shop settings (single row), deduplicated per request. */
export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .select(
      "shop_name, shop_address, shop_phone, receipt_footer, currency_code, currency_decimals, seller_max_discount_percent",
    )
    .maybeSingle();
  if (error) throw new Error(`Failed to load shop settings: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;

  const s = settingsSchema.parse(data);
  return {
    shopName: s.shop_name,
    shopAddress: s.shop_address,
    shopPhone: s.shop_phone,
    receiptFooter: s.receipt_footer,
    currency: { code: s.currency_code, decimals: s.currency_decimals },
    sellerMaxDiscountPercent: s.seller_max_discount_percent,
  };
});
