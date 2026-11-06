"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Minus, Plus } from "lucide-react";
import { checkSerials, parseSerials } from "@/lib/stock";
import type { FormState } from "@/lib/validation/form";
import { cn } from "@/lib/utils";
import { FormField, fieldAria } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { recordStockAdjustment } from "../stock-actions";

type Props = {
  productId: number;
  stock: number;
  tracksSerial: boolean;
  serials: { id: number; serialNumber: string }[];
};

const initialState: FormState = {};
type Direction = "in" | "out";

export function StockAdjustmentForm({ productId, stock, tracksSerial, serials }: Props) {
  const [state, formAction, pending] = useActionState(recordStockAdjustment, initialState);
  const e = state.errors ?? {};
  const [direction, setDirection] = useState<Direction>(
    state.values?.direction === "in" ? "in" : "out",
  );
  const [quantityText, setQuantityText] = useState(state.values?.quantity ?? "1");
  const [serialText, setSerialText] = useState(state.values?.serials ?? "");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const newSerials = parseSerials(serialText);
  const serialCheck = checkSerials(newSerials, newSerials.length);

  let quantity = quantityText;
  if (tracksSerial) quantity = String(direction === "in" ? newSerials.length : selected.size);

  const n = Number(quantity);
  const preview = Number.isInteger(n) && n > 0 ? stock + (direction === "in" ? n : -n) : null;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="direction" value={direction} />
      <FormMessage message={state.message} ok={state.ok} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Sens</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "out", label: "Sortie (perte, casse…)", icon: Minus },
              { value: "in", label: "Entrée (unité retrouvée…)", icon: Plus },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={direction === value}
              onClick={() => setDirection(value)}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                direction === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {!tracksSerial && (
        <FormField id="quantity" label="Quantité" error={e.quantity}>
          <Input
            name="quantity"
            inputMode="numeric"
            value={quantityText}
            onChange={(ev) => setQuantityText(ev.target.value)}
            className="max-w-40"
            {...fieldAria("quantity", e.quantity)}
          />
        </FormField>
      )}

      {tracksSerial && <input type="hidden" name="quantity" value={quantity} />}

      {tracksSerial && direction === "in" && (
        <FormField
          id="serials"
          label="Numéros de série / IMEI à ajouter"
          hint="Un numéro par ligne."
          error={e.serials ?? e.quantity}
        >
          <Textarea
            name="serials"
            rows={5}
            value={serialText}
            onChange={(ev) => setSerialText(ev.target.value)}
            className="font-mono"
            spellCheck={false}
            autoComplete="off"
            {...fieldAria("serials", e.serials ?? e.quantity, true)}
          />
          {!serialCheck.ok && serialCheck.error === "duplicates" && (
            <p className="text-sm text-destructive">En double : {serialCheck.duplicates.join(", ")}</p>
          )}
        </FormField>
      )}

      {tracksSerial && direction === "out" && (
        <fieldset className="flex flex-col gap-2" aria-describedby="serialIds-error">
          <legend className="mb-2 text-sm font-medium">Unités qui sortent du stock</legend>
          {serials.length === 0 ? (
            <p className="text-muted-foreground">Aucune unité en stock.</p>
          ) : (
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
              {serials.map((s) => (
                <label
                  key={s.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-mono text-sm",
                    selected.has(s.id) && "border-primary bg-primary/5",
                  )}
                >
                  <input
                    type="checkbox"
                    name="serialIds"
                    value={s.id}
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="size-5 accent-primary"
                  />
                  {s.serialNumber}
                </label>
              ))}
            </div>
          )}
          {(e.serialIds ?? e.quantity) && (
            <p id="serialIds-error" role="alert" className="text-sm text-destructive">
              {e.serialIds ?? e.quantity}
            </p>
          )}
        </fieldset>
      )}

      <FormField
        id="reason"
        label="Motif"
        hint="Obligatoire. Par exemple : inventaire du 06/11, écran cassé, vol."
        error={e.reason}
      >
        <Input name="reason" defaultValue={state.values?.reason} {...fieldAria("reason", e.reason, true)} />
      </FormField>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Stock actuel : <span className="font-semibold text-foreground">{stock}</span>
        {preview !== null && (
          <>
            {" "}
            → après ajustement :{" "}
            <span className={cn("font-semibold", preview < 0 ? "text-destructive" : "text-foreground")}>
              {preview}
            </span>
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={pending || (preview !== null && preview < 0)}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          Enregistrer l&apos;ajustement
        </Button>
        <Link href={`/produits/${productId}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Annuler
        </Link>
      </div>
    </form>
  );
}
