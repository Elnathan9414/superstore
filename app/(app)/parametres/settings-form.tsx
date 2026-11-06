"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import type { FormState } from "@/lib/validation/form";
import { FormField, fieldAria } from "@/components/form-field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveSettings } from "./actions";

export type SettingsDefaults = {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  receiptFooter: string;
  sellerMaxDiscountPercent: string;
};

const initialState: FormState = {};

export function SettingsForm({
  defaults,
  currencyLabel,
}: {
  defaults: SettingsDefaults;
  currencyLabel: string;
}) {
  const [state, formAction, pending] = useActionState(saveSettings, initialState);
  const e = state.errors ?? {};
  const v = (k: keyof SettingsDefaults) =>
    state.values && !state.ok ? (state.values[k] ?? "") : defaults[k];

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormMessage message={state.message} ok={state.ok} />

      <Card>
        <CardHeader>
          <CardTitle>Boutique et ticket de caisse</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField id="shopName" label="Nom de la boutique" error={e.shopName}>
            <Input name="shopName" defaultValue={v("shopName")} {...fieldAria("shopName", e.shopName)} />
          </FormField>
          <FormField id="shopPhone" label="Téléphone" error={e.shopPhone}>
            <Input
              name="shopPhone"
              inputMode="tel"
              defaultValue={v("shopPhone")}
              {...fieldAria("shopPhone", e.shopPhone)}
            />
          </FormField>
          <FormField id="shopAddress" label="Adresse" error={e.shopAddress} className="md:col-span-2">
            <Textarea
              name="shopAddress"
              rows={2}
              defaultValue={v("shopAddress")}
              {...fieldAria("shopAddress", e.shopAddress)}
            />
          </FormField>
          <FormField
            id="receiptFooter"
            label="Message en bas du ticket"
            error={e.receiptFooter}
            className="md:col-span-2"
          >
            <Textarea
              name="receiptFooter"
              rows={2}
              defaultValue={v("receiptFooter")}
              {...fieldAria("receiptFooter", e.receiptFooter)}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Caisse</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField
            id="sellerMaxDiscountPercent"
            label="Remise maximale des vendeurs (%)"
            hint="Les gérants et le propriétaire ne sont pas limités."
            error={e.sellerMaxDiscountPercent}
          >
            <Input
              name="sellerMaxDiscountPercent"
              inputMode="numeric"
              className="max-w-32"
              defaultValue={v("sellerMaxDiscountPercent")}
              {...fieldAria("sellerMaxDiscountPercent", e.sellerMaxDiscountPercent, true)}
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Devise</span>
            <p className="flex min-h-11 items-center">{currencyLabel}</p>
            <p className="text-sm text-muted-foreground">
              Non modifiable ici : changer de devise changerait la valeur des montants enregistrés.
            </p>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
