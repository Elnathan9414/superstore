import type { z } from "zod";

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

/** Common state returned by form Server Actions (used with useActionState). */
export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  /** Submitted values, echoed back so the form keeps them after an error */
  values?: Record<string, string | undefined>;
};
