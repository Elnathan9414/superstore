"use server";

import { revalidatePath } from "next/cache";
import { MANAGEMENT_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { mapDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formValues, type FormState } from "@/lib/validation/form";
import { categorySchema, idSchema } from "@/lib/validation/products";

const PATH = "/produits/categories";

function fail(error: { code?: string; message?: string }, values?: FormState["values"]): FormState {
  const mapped = mapDbError(error);
  return mapped.field
    ? { errors: { [mapped.field]: mapped.message }, values }
    : { message: mapped.message, values };
}

export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(MANAGEMENT_ROLES);
  const values = formValues(formData, ["name"]);
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({ name: parsed.data.name });
  if (error) return fail(error, values);

  revalidatePath(PATH);
  return { ok: true, message: `Catégorie « ${parsed.data.name} » ajoutée.` };
}

export async function renameCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(MANAGEMENT_ROLES);
  const id = idSchema.safeParse(formData.get("id"));
  const values = formValues(formData, ["name"]);
  const parsed = categorySchema.safeParse(values);
  if (!id.success) return { message: "Catégorie invalide." };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name })
    .eq("id", id.data)
    .select("id");
  if (error) return fail(error, values);
  if (!data?.length) return { message: "Catégorie introuvable." };

  revalidatePath(PATH);
  revalidatePath("/produits");
  return { ok: true };
}

export async function deleteCategory(categoryId: number): Promise<FormState> {
  await requireRole(MANAGEMENT_ROLES);
  const id = idSchema.safeParse(String(categoryId));
  if (!id.success) return { message: "Catégorie invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").delete().eq("id", id.data).select("id");
  if (error) {
    if (error.code === "23503") {
      return { message: "Cette catégorie contient des produits : déplacez-les avant de la supprimer." };
    }
    return fail(error);
  }
  if (!data?.length) return { message: "Catégorie introuvable." };

  revalidatePath(PATH);
  return { ok: true };
}
