import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MANAGEMENT_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PAGE_SIZE, listMovements } from "@/lib/data/catalog";
import { formatDateTime, shopDayStartIso } from "@/lib/dates";
import { firstParam, pageParam } from "@/lib/search";
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/stock";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export const metadata: Metadata = { title: "Mouvements de stock" };

function isMovementType(v: string | undefined): v is MovementType {
  return (MOVEMENT_TYPES as readonly string[]).includes(v ?? "");
}

export default async function MovementsPage({ searchParams }: PageProps<"/stock/mouvements">) {
  await requireRole(MANAGEMENT_ROLES);
  const params = await searchParams;
  const q = firstParam(params.q)?.trim() || undefined;
  const typeRaw = firstParam(params.type);
  const type = isMovementType(typeRaw) ? typeRaw : undefined;
  const du = firstParam(params.du);
  const au = firstParam(params.au);
  const fromIso = shopDayStartIso(du);
  const toIso = shopDayStartIso(au, 1);
  const page = pageParam(params.page);

  const { rows, total } = await listMovements({ q, type, fromIso, toIso, page });
  const typeItems: Record<string, string> = { tous: "Tous les types", ...MOVEMENT_TYPE_LABELS };
  const hasFilters = Boolean(q || type || fromIso || toIso);

  return (
    <>
      <Link
        href="/stock"
        className={cn(buttonVariants({ variant: "ghost" }), "mb-2 -ml-3 text-muted-foreground")}
      >
        <ArrowLeft aria-hidden />
        Stock
      </Link>
      <PageHeader
        title="Mouvements de stock"
        description="Historique complet et non modifiable des entrées, ventes, retours et ajustements."
      />

      <form
        action="/stock/mouvements"
        method="get"
        role="search"
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_10rem_auto] lg:items-end"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="mv-q">Produit</Label>
          <Input id="mv-q" name="q" type="search" defaultValue={q} placeholder="Nom ou SKU" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="mv-type">Type</Label>
          <Select name="type" items={typeItems} defaultValue={type ?? "tous"}>
            <SelectTrigger id="mv-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="mv-du">Du</Label>
          <Input id="mv-du" name="du" type="date" defaultValue={fromIso ? du : undefined} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="mv-au">Au</Label>
          <Input id="mv-au" name="au" type="date" defaultValue={toIso ? au : undefined} />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Filtrer</Button>
          {hasFilters && (
            <Link href="/stock/mouvements" className={buttonVariants({ variant: "ghost" })}>
              Effacer
            </Link>
          )}
        </div>
      </form>

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Aucun mouvement.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="hidden lg:table-cell">Motif</TableHead>
                  <TableHead className="hidden xl:table-cell">Par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell>
                      <Link href={`/produits/${m.productId}`} className="font-medium hover:underline">
                        {m.productName}
                      </Link>
                      <div className="text-sm text-muted-foreground">{m.productSku}</div>
                    </TableCell>
                    <TableCell>{MOVEMENT_TYPE_LABELS[m.type]}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        m.quantity < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </TableCell>
                    <TableCell className="hidden max-w-72 truncate lg:table-cell">{m.reason ?? "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell">{m.createdByName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination
            basePath="/stock/mouvements"
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            params={{ q, type, du: fromIso ? du : undefined, au: toIso ? au : undefined }}
          />
        </CardContent>
      </Card>
    </>
  );
}
