import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { requireSection } from "@/lib/auth/session";
import { getShopSettings } from "@/lib/data/settings";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { PointOfSale } from "./point-of-sale";

export const metadata: Metadata = { title: "Caisse" };

export default async function PosPage() {
  const profile = await requireSection("pos");
  const settings = await getShopSettings();

  return (
    <>
      <PageHeader
        title="Caisse"
        actions={
          <Link href="/caisse/ventes" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ReceiptText aria-hidden />
            Ventes
          </Link>
        }
      />
      <PointOfSale
        currency={settings.currency}
        discountCapPercent={profile.role === "seller" ? settings.sellerMaxDiscountPercent : null}
      />
    </>
  );
}
