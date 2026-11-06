import type { Metadata } from "next";
import { requireSection } from "@/lib/auth/session";
import { getShopSettings } from "@/lib/data/settings";
import { currencyLabel } from "@/lib/money";
import { PageHeader } from "@/components/app-shell/page-header";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  await requireSection("settings");
  const s = await getShopSettings();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Paramètres" description="Informations de la boutique et règles de caisse." />
      <SettingsForm
        currencyLabel={`${currencyLabel(s.currency)} (${s.currency.code})`}
        defaults={{
          shopName: s.shopName,
          shopAddress: s.shopAddress ?? "",
          shopPhone: s.shopPhone ?? "",
          receiptFooter: s.receiptFooter ?? "",
          sellerMaxDiscountPercent: String(s.sellerMaxDiscountPercent),
        }}
      />
    </div>
  );
}
