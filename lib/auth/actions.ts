"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH, safeRedirectPath } from "./redirect";
import { signInSchema } from "@/lib/validation/auth";
import { fieldErrors, formValues, type FieldErrors } from "@/lib/validation/form";

export type SignInState = {
  errors?: FieldErrors;
  message?: string;
  email?: string;
};

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const values = formValues(formData, ["email", "password"]);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), email: values.email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for unknown email and wrong password (no account probing).
    const message =
      error.status === 429
        ? "Trop de tentatives. Réessayez dans quelques minutes."
        : "Email ou mot de passe incorrect.";
    return { message, email: parsed.data.email };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
