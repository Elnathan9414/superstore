"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import type { FormState } from "@/lib/validation/form";
import { FormField, fieldAria } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, deleteCategory, renameCategory } from "./actions";

const initialState: FormState = {};

export function CategoryCreateForm() {
  const [state, formAction, pending] = useActionState(createCategory, initialState);
  const e = state.errors ?? {};

  return (
    // Remount after success to clear the field
    <form key={state.ok ? state.message : "form"} action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage message={state.message} ok={state.ok} />
      <FormField id="category-name" label="Nom" error={e.name}>
        <Input
          name="name"
          defaultValue={state.ok ? "" : state.values?.name}
          placeholder="Ex. : Téléphones"
          {...fieldAria("category-name", e.name)}
        />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden />}
        Ajouter
      </Button>
    </form>
  );
}

export function CategoryRow({
  id,
  name,
  productCount,
}: {
  id: number;
  name: string;
  productCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, saving] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await renameCategory(prev, formData);
      // Leave edit mode once the rename succeeded
      if (result.ok) setEditing(false);
      return result;
    },
    initialState,
  );
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string>();

  const fieldError = state.errors?.name ?? state.message;

  if (editing) {
    return (
      <li className="py-3">
        <form action={formAction} className="flex flex-wrap items-start gap-2" noValidate>
          <input type="hidden" name="id" value={id} />
          <Input
            name="name"
            defaultValue={state.values?.name ?? name}
            aria-label={`Nouveau nom pour ${name}`}
            className="min-w-48 flex-1"
            autoFocus
            {...(fieldError ? { "aria-invalid": true } : {})}
          />
          <Button type="submit" size="icon" aria-label="Enregistrer" disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Annuler"
            onClick={() => setEditing(false)}
          >
            <X aria-hidden />
          </Button>
          {fieldError && !state.ok && (
            <p role="alert" className="w-full text-sm text-destructive">
              {fieldError}
            </p>
          )}
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">{name}</span>
        <span className="text-sm text-muted-foreground">
          {productCount} produit{productCount > 1 ? "s" : ""}
        </span>
        <Button variant="ghost" size="icon" aria-label={`Renommer ${name}`} onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Supprimer ${name}`}
          disabled={deleting || productCount > 0}
          title={productCount > 0 ? "Catégorie utilisée par des produits" : undefined}
          onClick={() => {
            if (!window.confirm(`Supprimer la catégorie « ${name} » ?`)) return;
            setError(undefined);
            startDelete(async () => {
              const result = await deleteCategory(id);
              if (!result.ok) setError(result.message);
            });
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
