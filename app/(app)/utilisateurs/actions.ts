"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createUserSchema,
  fieldErrors,
  formValues,
  setActiveSchema,
  updateRoleSchema,
  type FieldErrors,
} from "@/lib/validation/auth";

const USERS_PATH = "/utilisateurs";
// ~100 years: Supabase Auth has no "permanent" ban value.
const PERMANENT_BAN = "876000h";

export type ActionResult = { ok?: boolean; message?: string };
export type CreateUserState = ActionResult & {
  errors?: FieldErrors;
  values?: { fullName?: string; email?: string; role?: string };
};

const MISSING_SERVICE_KEY =
  "La création de comptes n'est pas configurée sur le serveur (SUPABASE_SERVICE_ROLE_KEY manquante).";

function profileErrorMessage(error: PostgrestError): string {
  if (error.hint === "last_owner") {
    return "Impossible : il doit rester au moins un propriétaire actif.";
  }
  console.error("Profile update failed:", error);
  return "La modification a échoué. Réessayez.";
}

export async function createUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await requireRole(["owner"]);

  const values = formValues(formData, ["fullName", "email", "password", "role"]);
  const kept = { fullName: values.fullName, email: values.email, role: values.role };
  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: kept };
  }

  const admin = createAdminClient();
  if (!admin) return { message: MISSING_SERVICE_KEY, values: kept };

  const { fullName, email, password, role } = parsed.data;
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    // app_metadata is server-controlled; the DB trigger reads the role from it
    app_metadata: { role },
  });

  if (error) {
    if (error.code === "email_exists" || error.code === "user_already_exists") {
      return { errors: { email: "Un compte existe déjà avec cet email." }, values: kept };
    }
    if (error.code === "weak_password") {
      return {
        errors: { password: "Mot de passe trop faible selon la politique Supabase." },
        values: kept,
      };
    }
    console.error("Create user failed:", error);
    return { message: "La création du compte a échoué. Réessayez.", values: kept };
  }

  revalidatePath(USERS_PATH);
  return { ok: true, message: `Compte créé pour ${fullName}.` };
}

export async function updateRole(input: unknown): Promise<ActionResult> {
  const me = await requireRole(["owner"]);
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return { message: "Données invalides." };

  const { userId, role } = parsed.data;
  if (userId === me.id) {
    return { message: "Vous ne pouvez pas modifier votre propre rôle." };
  }

  // Regular client: RLS ("owner updates profiles") and the last-owner
  // trigger are enforced by the database.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");

  if (error) return { message: profileErrorMessage(error) };
  if (!data?.length) return { message: "Utilisateur introuvable." };

  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setActive(input: unknown): Promise<ActionResult> {
  const me = await requireRole(["owner"]);
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { message: "Données invalides." };

  const { userId, active } = parsed.data;
  if (userId === me.id) {
    return { message: "Vous ne pouvez pas désactiver votre propre compte." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId)
    .select("id");

  if (error) return { message: profileErrorMessage(error) };
  if (!data?.length) return { message: "Utilisateur introuvable." };

  // Data access is already cut by is_active (RLS). Banning also stops the
  // user's session from being refreshed. Best effort if the key is missing.
  const admin = createAdminClient();
  if (admin) {
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : PERMANENT_BAN,
    });
    if (banError) console.error("Ban update failed:", banError);
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
}
