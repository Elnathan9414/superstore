import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
import { StockBadge } from "@/components/stock-badge";
import { loadProduct } from "../load-product";
import { StockEntryForm } from "./entry-form";

export const metadata: Metadata = { title: "Entrée de stock" };

export default async function StockEntryPage({ params }: PageProps<"/produits/[id]/entree">) {
  await requireSection("products");
  const product = await loadProduct(params);
  if (!product.isActive) redirect(`/produits/${product.id}`);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Entrée de stock" description={`${product.name} · ${product.sku}`} />
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Stock actuel : <StockBadge stock={product.stock} minStock={product.minStock} />
          </div>
          <StockEntryForm productId={product.id} tracksSerial={product.tracksSerial} />
        </CardContent>
      </Card>
    </div>
  );
}
