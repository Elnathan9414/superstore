import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSection } from "@/lib/auth/session";
import { PAGE_SIZE, getCurrency, listCategories, listProducts } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";
import { pageParam } from "@/lib/search";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell/page-header";
import { Pagination } from "@/components/pagination";
import { ProductFilters, readProductFilters } from "@/components/product-filters";
import { StockBadge } from "@/components/stock-badge";
import { ProductsTabs } from "./products-tabs";

export const metadata: Metadata = { title: "Produits" };

const STATUS = { bas: "Stock bas", archives: "Archivés" };

export default async function ProductsPage({ searchParams }: PageProps<"/produits">) {
  await requireSection("products");
  const params = await searchParams;
  const filters = readProductFilters(params, Object.keys(STATUS));
  const page = pageParam(params.page);

  const [currency, categories, { rows, total }] = await Promise.all([
    getCurrency(),
    listCategories(),
    listProducts({
      q: filters.q,
      categoryId: filters.categorie ? Number(filters.categorie) : undefined,
      lowStock: filters.filtre === "bas",
      archived: filters.filtre === "archives",
      page,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Produits"
        description="Catalogue, prix et paramètres de stock."
        actions={
          <Link href="/produits/nouveau" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            Nouveau produit
          </Link>
        }
      />
      <ProductsTabs active="products" />
      <ProductFilters
        basePath="/produits"
        values={filters}
        categories={categories}
        statusOptions={STATUS}
      />

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {total === 0 && !filters.q && !filters.categorie && !filters.filtre
                ? "Aucun produit pour l'instant. Commencez par en créer un."
                : "Aucun produit ne correspond à ces critères."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="hidden lg:table-cell">Catégorie</TableHead>
                  <TableHead className="text-right">Prix de vente</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} className="relative">
                    <TableCell className="py-3">
                      <Link
                        href={`/produits/${p.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{p.sku}</span>
                        {p.brand && <span>· {p.brand}</span>}
                        {p.tracksSerial && <Badge variant="outline">N° de série</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {p.categoryName ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.salePrice, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StockBadge stock={p.stock} minStock={p.minStock} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination
            basePath="/produits"
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            params={filters}
          />
        </CardContent>
      </Card>
    </>
  );
}
