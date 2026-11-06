import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";

export const MIN_PASSWORD_LENGTH = 8;

const email = z
  .string({ error: "L'email est obligatoire." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Adresse email invalide." }));

export const signInSchema = z.object({
  email,
  password: z
    .string({ error: "Le mot de passe est obligatoire." })
    .min(1, { error: "Le mot de passe est obligatoire." }),
});

export const createUserSchema = z.object({
  fullName: z
    .string({ error: "Le nom est obligatoire." })
    .trim()
    .min(2, { error: "Le nom doit contenir au moins 2 caractères." })
    .max(100, { error: "Le nom est trop long." }),
  email,
  password: z
    .string({ error: "Le mot de passe est obligatoire." })
    .min(MIN_PASSWORD_LENGTH, {
      error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    })
    .max(72, { error: "Le mot de passe est trop long." }),
  role: z.enum(ROLES, { error: "Rôle invalide." }),
});

export const updateRoleSchema = z.object({
  userId: z.uuid({ error: "Utilisateur invalide." }),
  role: z.enum(ROLES, { error: "Rôle invalide." }),
});

export const setActiveSchema = z.object({
  userId: z.uuid({ error: "Utilisateur invalide." }),
  active: z.boolean({ error: "Valeur invalide." }),
});

export type FieldErrors = Partial<Record<string, string>>;

/** Flattens zod issues into one message per field (first issue wins). */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

/** Reads string entries from FormData into a plain object for zod. */
export function formValues(formData: FormData, keys: readonly string[]) {
  const values: Record<string, string | undefined> = {};
  for (const key of keys) {
    const v = formData.get(key);
    values[key] = typeof v === "string" ? v : undefined;
  }
  return values;
}
