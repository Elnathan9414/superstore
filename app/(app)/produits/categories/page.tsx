import type { Metadata } from "next";
import { requireSection } from "@/lib/auth/session";
import { listCategoriesWithCounts } from "@/lib/data/catalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProductsTabs } from "../products-tabs";
import { CategoryCreateForm, CategoryRow } from "./category-forms";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  await requireSection("products");
  const categories = await listCategoriesWithCounts();

  return (
    <>
      <PageHeader title="Produits" description="Catalogue, prix et paramètres de stock." />
      <ProductsTabs active="categories" />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Catégories ({categories.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-muted-foreground">Aucune catégorie pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {categories.map((c) => (
                  <CategoryRow key={c.id} id={c.id} name={c.name} productCount={c.productCount} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nouvelle catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryCreateForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
