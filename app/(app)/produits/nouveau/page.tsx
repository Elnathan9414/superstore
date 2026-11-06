import type { Metadata } from "next";
import { requireSection } from "@/lib/auth/session";
import { getCurrency, listCategories } from "@/lib/data/catalog";
import { currencyLabel } from "@/lib/money";
import { PageHeader } from "@/components/app-shell/page-header";
import { EMPTY_PRODUCT, ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  await requireSection("products");
  const [currency, categories] = await Promise.all([getCurrency(), listCategories()]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nouveau produit"
        description="Le stock part de zéro : ajoutez-le ensuite avec une entrée de stock."
      />
      <ProductForm
        defaults={EMPTY_PRODUCT}
        categories={categories}
        currencyLabel={currencyLabel(currency)}
      />
    </div>
  );
}
