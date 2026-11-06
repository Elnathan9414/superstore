"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth/session";
import { mapDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formValues, type FormState } from "@/lib/validation/form";
import { settingsSchema } from "@/lib/validation/sale";

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("settings");
  const values = formValues(formData, [
    "shopName",
    "shopAddress",
    "shopPhone",
    "receiptFooter",
    "sellerMaxDiscountPercent",
  ]);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const s = parsed.data;
  const supabase = await createClient();
  // Single-row table (id = true); RLS: owner only
  const { data, error } = await supabase
    .from("shop_settings")
    .update({
      shop_name: s.shopName,
      shop_address: s.shopAddress,
      shop_phone: s.shopPhone,
      receipt_footer: s.receiptFooter,
      seller_max_discount_percent: s.sellerMaxDiscountPercent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select("id");

  if (error) return { message: mapDbError(error).message, values };
  if (!data?.length) return { message: "Paramètres introuvables.", values };

  revalidatePath("/", "layout");
  return { ok: true, message: "Paramètres enregistrés." };
}
