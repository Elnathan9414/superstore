import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSection } from "@/lib/auth/session";
import { SALES_PAGE_SIZE, listSales } from "@/lib/data/sales";
import { getShopSettings } from "@/lib/data/settings";
import { formatDateTime, shopDayStartIso } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { receiptNumber } from "@/lib/sale";
import { firstParam, pageParam } from "@/lib/search";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = { title: "Ventes" };

const STATUS_ITEMS = {
  toutes: "Toutes",
  credit: "Non soldées (crédit)",
  annulees: "Annulées",
} as const;

export default async function SalesPage({ searchParams }: PageProps<"/caisse/ventes">) {
  await requireSection("pos");
  const params = await searchParams;
  const du = firstParam(params.du);
  const au = firstParam(params.au);
  const statutRaw = firstParam(params.statut);
  const statut = statutRaw && statutRaw in STATUS_ITEMS ? statutRaw : "toutes";
  const fromIso = shopDayStartIso(du);
  const toIso = shopDayStartIso(au, 1);
  const page = pageParam(params.page);

  const [settings, { rows, total }] = await Promise.all([
    getShopSettings(),
    listSales({
      fromIso,
      toIso,
      status: statut === "annulees" ? "cancelled" : undefined,
      unpaidOnly: statut === "credit",
      page,
    }),
  ]);
  const money = (n: number) => formatMoney(n, settings.currency);
  const hasFilters = Boolean(fromIso || toIso || statut !== "toutes");

  return (
    <>
      <Link
        href="/caisse"
        className={cn(buttonVariants({ variant: "ghost" }), "mb-2 -ml-3 text-muted-foreground")}
      >
        <ArrowLeft aria-hidden />
        Caisse
      </Link>
      <PageHeader title="Ventes" description="Historique des ventes et réimpression des tickets." />

      <form
        action="/caisse/ventes"
        method="get"
        className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-[12rem_10rem_10rem_auto] lg:items-end"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-statut">Statut</Label>
          <Select name="statut" items={STATUS_ITEMS} defaultValue={statut}>
            <SelectTrigger id="v-statut" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-du">Du</Label>
          <Input id="v-du" name="du" type="date" defaultValue={fromIso ? du : undefined} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-au">Au</Label>
          <Input id="v-au" name="au" type="date" defaultValue={toIso ? au : undefined} />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Filtrer</Button>
          {hasFilters && (
            <Link href="/caisse/ventes" className={buttonVariants({ variant: "ghost" })}>
              Effacer
            </Link>
          )}
        </div>
      </form>

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Aucune vente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="hidden lg:table-cell">Vendeur</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} className="relative">
                    <TableCell className="py-3">
                      <Link
                        href={`/caisse/ventes/${s.id}`}
                        className="font-mono font-medium after:absolute after:inset-0 hover:underline"
                      >
                        {receiptNumber(s.id)}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.customerName ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{s.sellerName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(s.total)}</TableCell>
                    <TableCell className="text-right">
                      {s.status === "cancelled" ? (
                        <Badge variant="destructive">Annulée</Badge>
                      ) : s.balance > 0 ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
                        >
                          Doit {money(s.balance)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Payée</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination
            basePath="/caisse/ventes"
            page={page}
            pageSize={SALES_PAGE_SIZE}
            total={total}
            params={{
              statut: statut === "toutes" ? undefined : statut,
              du: fromIso ? du : undefined,
              au: toIso ? au : undefined,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
