import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, Pencil, SlidersHorizontal } from "lucide-react";
import { requireSection } from "@/lib/auth/session";
import {
  getCurrency,
  getProductCost,
  listMovements,
  listSerialsInStock,
} from "@/lib/data/catalog";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { CONDITION_LABELS, MOVEMENT_TYPE_LABELS } from "@/lib/stock";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell/page-header";
import { StockBadge } from "@/components/stock-badge";
import { ArchiveButton } from "./archive-button";
import { loadProduct } from "./load-product";

export const metadata: Metadata = { title: "Produit" };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function ProductPage({ params }: PageProps<"/produits/[id]">) {
  await requireSection("products");
  const product = await loadProduct(params);
  const [currency, cost, serials, movements] = await Promise.all([
    getCurrency(),
    getProductCost(product.id),
    product.tracksSerial ? listSerialsInStock(product.id) : Promise.resolve([]),
    listMovements({ productId: product.id, pageSize: 20 }),
  ]);
  const margin = cost !== null ? product.salePrice - cost : null;

  return (
    <>
      <Link
        href="/produits"
        className={cn(buttonVariants({ variant: "ghost" }), "mb-2 -ml-3 text-muted-foreground")}
      >
        <ArrowLeft aria-hidden />
        Produits
      </Link>
      <PageHeader
        title={product.name}
        description={[product.sku, product.brand, product.categoryName].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            {product.isActive && (
              <>
                <Link href={`/produits/${product.id}/entree`} className={buttonVariants({ size: "lg" })}>
                  <ArrowDownToLine aria-hidden />
                  Entrée de stock
                </Link>
                <Link
                  href={`/produits/${product.id}/ajustement`}
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  <SlidersHorizontal aria-hidden />
                  Ajuster
                </Link>
              </>
            )}
            <Link
              href={`/produits/${product.id}/modifier`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Pencil aria-hidden />
              Modifier
            </Link>
          </div>
        }
      />

      {!product.isActive && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
          <p className="text-muted-foreground">
            Produit archivé : il n&apos;apparaît plus dans le stock ni à la caisse.
          </p>
          <ArchiveButton productId={product.id} isActive={false} name={product.name} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 xl:grid-cols-1">
              <Info label="Stock">
                <StockBadge stock={product.stock} minStock={product.minStock} />
              </Info>
              <Info label="Stock minimum">{product.minStock}</Info>
              <Info label="Prix de vente">{formatMoney(product.salePrice, currency)}</Info>
              {cost !== null && (
                <Info label="Prix d'achat">{formatMoney(cost, currency)}</Info>
              )}
              {margin !== null && (
                <Info label="Marge unitaire">
                  <span className={cn(margin < 0 && "text-destructive")}>
                    {formatMoney(margin, currency)}
                  </span>
                </Info>
              )}
              <Info label="État">{CONDITION_LABELS[product.condition]}</Info>
              <Info label="Garantie">
                {product.warrantyMonths > 0 ? `${product.warrantyMonths} mois` : "Aucune"}
              </Info>
              <Info label="Code-barres">{product.barcode ?? "—"}</Info>
              <Info label="Numéro de série">{product.tracksSerial ? "Suivi" : "Non suivi"}</Info>
            </dl>
            {product.description && (
              <p className="mt-4 whitespace-pre-line text-muted-foreground">{product.description}</p>
            )}
            {product.isActive && (
              <div className="mt-6 border-t pt-4">
                <ArchiveButton productId={product.id} isActive name={product.name} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-2">
          {product.tracksSerial && (
            <Card>
              <CardHeader>
                <CardTitle>Unités en stock ({serials.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {serials.length === 0 ? (
                  <p className="text-muted-foreground">Aucune unité en stock.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {serials.map((s) => (
                      <li key={s.id}>
                        <Badge variant="outline" className="h-8 px-3 font-mono text-sm">
                          {s.serialNumber}
                        </Badge>
                        <span className="sr-only">, entré le {formatDate(s.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Derniers mouvements</CardTitle>
              {movements.total > movements.rows.length && (
                <Link
                  href={`/stock/mouvements?q=${encodeURIComponent(product.sku)}`}
                  className={buttonVariants({ variant: "link" })}
                >
                  Tout voir ({movements.total})
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {movements.rows.length === 0 ? (
                <p className="text-muted-foreground">Aucun mouvement de stock.</p>
              ) : (
                <MovementTable rows={movements.rows} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function MovementTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof listMovements>>["rows"];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Quantité</TableHead>
          <TableHead className="hidden md:table-cell">Motif</TableHead>
          <TableHead className="hidden lg:table-cell">Par</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
            <TableCell>{MOVEMENT_TYPE_LABELS[m.type]}</TableCell>
            <TableCell
              className={cn(
                "text-right font-medium tabular-nums",
                m.quantity < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
            </TableCell>
            <TableCell className="hidden max-w-64 truncate md:table-cell">{m.reason ?? "—"}</TableCell>
            <TableCell className="hidden lg:table-cell">{m.createdByName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
