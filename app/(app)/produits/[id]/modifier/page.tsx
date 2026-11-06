import type { Metadata } from "next";
import { requireSection } from "@/lib/auth/session";
import { getCurrency, getProductCost, listCategories } from "@/lib/data/catalog";
import { currencyLabel, moneyToInput } from "@/lib/money";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProductForm } from "../../product-form";
import { loadProduct } from "../load-product";

export const metadata: Metadata = { title: "Modifier le produit" };

export default async function EditProductPage({ params }: PageProps<"/produits/[id]/modifier">) {
  await requireSection("products");
  const product = await loadProduct(params);
  const [currency, categories, cost] = await Promise.all([
    getCurrency(),
    listCategories(),
    getProductCost(product.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Modifier le produit" description={product.name} />
      <ProductForm
        productId={product.id}
        categories={categories}
        currencyLabel={currencyLabel(currency)}
        trackingLocked={product.stock !== 0}
        defaults={{
          sku: product.sku,
          barcode: product.barcode ?? "",
          name: product.name,
          brand: product.brand ?? "",
          categoryId: product.categoryId ? String(product.categoryId) : "none",
          description: product.description ?? "",
          condition: product.condition,
          costPrice: moneyToInput(cost ?? 0, currency.decimals),
          salePrice: moneyToInput(product.salePrice, currency.decimals),
          tracksSerial: product.tracksSerial,
          warrantyMonths: String(product.warrantyMonths),
          minStock: String(product.minStock),
        }}
      />
    </div>
  );
}
