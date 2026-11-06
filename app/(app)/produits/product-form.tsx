"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { CONDITION_LABELS, PRODUCT_CONDITIONS } from "@/lib/stock";
import type { FormState } from "@/lib/validation/form";
import { FormField, fieldAria } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveProduct } from "./actions";

export type ProductFormDefaults = {
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  condition: string;
  costPrice: string;
  salePrice: string;
  tracksSerial: boolean;
  warrantyMonths: string;
  minStock: string;
};

export const EMPTY_PRODUCT: ProductFormDefaults = {
  sku: "",
  barcode: "",
  name: "",
  brand: "",
  categoryId: "none",
  description: "",
  condition: "new",
  costPrice: "",
  salePrice: "",
  tracksSerial: false,
  warrantyMonths: "0",
  minStock: "0",
};

type Props = {
  productId?: number;
  defaults: ProductFormDefaults;
  categories: { id: number; name: string }[];
  currencyLabel: string;
  /** Serial tracking cannot change while units are in stock */
  trackingLocked?: boolean;
};

const initialState: FormState = {};

export function ProductForm({ productId, defaults, categories, currencyLabel, trackingLocked }: Props) {
  const [state, formAction, pending] = useActionState(saveProduct, initialState);
  const e = state.errors ?? {};
  // After a failed submit, show what the user typed rather than the defaults
  const v = (key: keyof ProductFormDefaults): string =>
    state.values ? (state.values[key] ?? "") : String(defaults[key]);
  const tracks = state.values ? state.values.tracksSerial === "on" : defaults.tracksSerial;

  const categoryItems: Record<string, string> = { none: "Sans catégorie" };
  for (const c of categories) categoryItems[String(c.id)] = c.name;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {productId && <input type="hidden" name="productId" value={productId} />}
      <FormMessage message={state.message} ok={state.ok} />

      <Card>
        <CardHeader>
          <CardTitle>Identification</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField id="name" label="Nom du produit" error={e.name} className="md:col-span-2">
            <Input name="name" defaultValue={v("name")} {...fieldAria("name", e.name)} />
          </FormField>
          <FormField id="sku" label="SKU (référence interne)" error={e.sku}>
            <Input
              name="sku"
              defaultValue={v("sku")}
              autoCapitalize="characters"
              {...fieldAria("sku", e.sku)}
            />
          </FormField>
          <FormField
            id="barcode"
            label="Code-barres"
            hint="Facultatif. Placez le curseur ici et scannez."
            error={e.barcode}
          >
            <Input
              name="barcode"
              defaultValue={v("barcode")}
              inputMode="numeric"
              autoComplete="off"
              {...fieldAria("barcode", e.barcode, true)}
            />
          </FormField>
          <FormField id="brand" label="Marque" error={e.brand}>
            <Input name="brand" defaultValue={v("brand")} {...fieldAria("brand", e.brand)} />
          </FormField>
          <FormField id="categoryId" label="Catégorie" error={e.categoryId}>
            <Select name="categoryId" items={categoryItems} defaultValue={v("categoryId") || "none"}>
              <SelectTrigger className="w-full" {...fieldAria("categoryId", e.categoryId)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="condition" label="État" error={e.condition}>
            <Select name="condition" items={CONDITION_LABELS} defaultValue={v("condition") || "new"}>
              <SelectTrigger className="w-full" {...fieldAria("condition", e.condition)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONDITION_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="description" label="Description" error={e.description} className="md:col-span-2">
            <Textarea
              name="description"
              rows={3}
              defaultValue={v("description")}
              {...fieldAria("description", e.description)}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prix ({currencyLabel})</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            id="costPrice"
            label="Prix d'achat"
            hint="Visible uniquement par les gérants et le propriétaire."
            error={e.costPrice}
          >
            <Input
              name="costPrice"
              inputMode="decimal"
              defaultValue={v("costPrice")}
              {...fieldAria("costPrice", e.costPrice, true)}
            />
          </FormField>
          <FormField id="salePrice" label="Prix de vente" error={e.salePrice}>
            <Input
              name="salePrice"
              inputMode="decimal"
              defaultValue={v("salePrice")}
              {...fieldAria("salePrice", e.salePrice)}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock et garantie</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            id="minStock"
            label="Stock minimum"
            hint="Une alerte s'affiche quand le stock descend à ce niveau."
            error={e.minStock}
          >
            <Input
              name="minStock"
              inputMode="numeric"
              defaultValue={v("minStock")}
              {...fieldAria("minStock", e.minStock, true)}
            />
          </FormField>
          <FormField id="warrantyMonths" label="Garantie (mois)" error={e.warrantyMonths}>
            <Input
              name="warrantyMonths"
              inputMode="numeric"
              defaultValue={v("warrantyMonths")}
              {...fieldAria("warrantyMonths", e.warrantyMonths)}
            />
          </FormField>
          <div className="flex flex-col gap-2 md:col-span-2">
            <label
              htmlFor="tracksSerial"
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 has-disabled:cursor-not-allowed has-disabled:opacity-60"
            >
              <input
                type="checkbox"
                id="tracksSerial"
                name="tracksSerial"
                defaultChecked={tracks}
                disabled={trackingLocked}
                className="size-5 accent-primary"
                aria-describedby="tracksSerial-hint"
              />
              <span className="flex flex-col">
                <span className="font-medium">Suivi par numéro de série / IMEI</span>
                <span id="tracksSerial-hint" className="text-sm text-muted-foreground">
                  {trackingLocked
                    ? "Non modifiable tant que le produit a du stock."
                    : "Pour les téléphones, ordinateurs, etc. Chaque unité aura son numéro."}
                </span>
              </span>
            </label>
            {/* A disabled checkbox is not submitted: keep the current value */}
            {trackingLocked && tracks && <input type="hidden" name="tracksSerial" value="on" />}
            {e.tracksSerial && (
              <p role="alert" className="text-sm text-destructive">
                {e.tracksSerial}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {productId ? "Enregistrer" : "Créer le produit"}
        </Button>
        <Link
          href={productId ? `/produits/${productId}` : "/produits"}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
