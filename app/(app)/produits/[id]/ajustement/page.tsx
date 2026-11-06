import type { Metadata } from "next";
import { requireSection } from "@/lib/auth/session";
import { listSerialsInStock } from "@/lib/data/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
import { loadProduct } from "../load-product";
import { StockAdjustmentForm } from "./adjustment-form";

export const metadata: Metadata = { title: "Ajustement de stock" };

export default async function StockAdjustmentPage({
  params,
}: PageProps<"/produits/[id]/ajustement">) {
  await requireSection("products");
  const product = await loadProduct(params);
  const serials = product.tracksSerial ? await listSerialsInStock(product.id) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Ajustement de stock"
        description={`${product.name} · ${product.sku}`}
      />
      <Card>
        <CardContent>
          <StockAdjustmentForm
            productId={product.id}
            stock={product.stock}
            tracksSerial={product.tracksSerial}
            serials={serials.map((s) => ({ id: s.id, serialNumber: s.serialNumber }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
