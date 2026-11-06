"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { checkSerials, parseSerials } from "@/lib/stock";
import type { FormState } from "@/lib/validation/form";
import { FormField, fieldAria } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { recordStockEntry } from "../stock-actions";

const initialState: FormState = {};

export function StockEntryForm({
  productId,
  tracksSerial,
}: {
  productId: number;
  tracksSerial: boolean;
}) {
  const [state, formAction, pending] = useActionState(recordStockEntry, initialState);
  const e = state.errors ?? {};
  const [serialText, setSerialText] = useState(state.values?.serials ?? "");
  const [quantityText, setQuantityText] = useState(state.values?.quantity ?? "1");

  // Tracked products: the quantity is the number of serials typed/scanned
  const serials = parseSerials(serialText);
  const check = checkSerials(serials, serials.length);
  const quantity = tracksSerial ? String(serials.length) : quantityText;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <FormMessage message={state.message} ok={state.ok} />

      {tracksSerial ? (
        <>
          <input type="hidden" name="quantity" value={quantity} />
          <FormField
            id="serials"
            label="Numéros de série / IMEI"
            hint="Un numéro par ligne. Avec une douchette, scannez les unités les unes après les autres."
            error={e.serials ?? e.quantity}
          >
            <Textarea
              name="serials"
              rows={8}
              value={serialText}
              onChange={(ev) => setSerialText(ev.target.value)}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              {...fieldAria("serials", e.serials ?? e.quantity, true)}
            />
          </FormField>
          <p className="text-sm" aria-live="polite">
            <span className="font-semibold">{serials.length}</span> unité(s) à ajouter
            {!check.ok && check.error === "duplicates" && (
              <span className="text-destructive">
                {" "}
                · en double : {check.duplicates.join(", ")}
              </span>
            )}
          </p>
        </>
      ) : (
        <FormField id="quantity" label="Quantité reçue" error={e.quantity}>
          <Input
            name="quantity"
            inputMode="numeric"
            value={quantityText}
            onChange={(ev) => setQuantityText(ev.target.value)}
            className="max-w-40"
            autoFocus
            {...fieldAria("quantity", e.quantity)}
          />
        </FormField>
      )}

      <FormField
        id="reason"
        label="Note (facultatif)"
        hint="Par exemple : fournisseur, numéro de facture."
        error={e.reason}
      >
        <Input name="reason" defaultValue={state.values?.reason} {...fieldAria("reason", e.reason, true)} />
      </FormField>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={pending || (tracksSerial && (serials.length === 0 || !check.ok))}
        >
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          Enregistrer l&apos;entrée
        </Button>
        <Link href={`/produits/${productId}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Annuler
        </Link>
      </div>
    </form>
  );
}
