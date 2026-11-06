import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, History } from "lucide-react";
import { canManageStock } from "@/lib/auth/roles";
import { requireSection } from "@/lib/auth/session";
import { PAGE_SIZE, getCurrency, listCategories, listProducts } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";
import { pageParam } from "@/lib/search";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

export const metadata: Metadata = { title: "Stock" };

const STATUS = { bas: "Stock bas ou rupture" };

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const profile = await requireSection("stock");
  const canManage = canManageStock(profile.role);
  const params = await searchParams;
  const filters = readProductFilters(params, Object.keys(STATUS));
  const page = pageParam(params.page);

  // product_overview never exposes purchase prices: safe for sellers
  const [currency, categories, { rows, total }] = await Promise.all([
    getCurrency(),
    listCategories(),
    listProducts({
      q: filters.q,
      categoryId: filters.categorie ? Number(filters.categorie) : undefined,
      lowStock: filters.filtre === "bas",
      page,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Stock"
        description="Quantités disponibles, calculées à partir des mouvements de stock."
        actions={
          canManage && (
            <Link href="/stock/mouvements" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <History aria-hidden />
              Mouvements
            </Link>
          )
        }
      />
      <ProductFilters
        basePath="/stock"
        values={filters}
        categories={categories}
        statusOptions={STATUS}
      />

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              Aucun produit ne correspond à ces critères.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  {canManage && <TableHead className="w-0"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="py-3">
                      {canManage ? (
                        <Link href={`/produits/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{p.name}</span>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{p.sku}</span>
                        {p.barcode && <span className="hidden sm:inline">· {p.barcode}</span>}
                        {p.tracksSerial && <Badge variant="outline">N° de série</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.categoryName ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.salePrice, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StockBadge stock={p.stock} minStock={p.minStock} />
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Link
                          href={`/produits/${p.id}/entree`}
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                          aria-label={`Entrée de stock : ${p.name}`}
                          title="Entrée de stock"
                        >
                          <ArrowDownToLine aria-hidden />
                        </Link>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination basePath="/stock" page={page} pageSize={PAGE_SIZE} total={total} params={filters} />
        </CardContent>
      </Card>
    </>
  );
}
