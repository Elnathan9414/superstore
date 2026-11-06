import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { canSeeCosts } from "@/lib/auth/roles";
import { requireSection } from "@/lib/auth/session";
import { getSale } from "@/lib/data/sales";
import { getShopSettings } from "@/lib/data/settings";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { receiptNumber } from "@/lib/sale";
import { firstParam } from "@/lib/search";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { idSchema } from "@/lib/validation/products";
import { Receipt } from "./receipt";
import { CancelSale, PrintButton } from "./sale-actions";

export const metadata: Metadata = { title: "Vente" };

export default async function SalePage({ params, searchParams }: PageProps<"/caisse/ventes/[id]">) {
  const profile = await requireSection("pos");
  const { id } = await params;
  const query = await searchParams;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const [sale, settings] = await Promise.all([getSale(parsedId.data), getShopSettings()]);
  if (!sale) notFound();

  const format = firstParam(query.format) === "a4" ? "a4" : "ticket";
  const autoPrint = firstParam(query.imprimer) === "1";
  const managers = canSeeCosts(profile.role);
  const money = (n: number) => formatMoney(n, settings.currency);

  // Margin (managers only): costs are null for sellers anyway (RLS)
  const cost = managers
    ? sale.items.reduce((sum, i) => sum + (i.unitCost ?? 0) * i.quantity, 0)
    : null;
  const margin = cost !== null ? sale.total - cost : null;

  const formatHref = (f: "ticket" | "a4") =>
    `/caisse/ventes/${sale.id}${f === "a4" ? "?format=a4" : ""}`;

  return (
    <>
      {/* Page size for printing: 80 mm roll or A4 */}
      <style>{`@media print { @page { ${
        format === "ticket" ? "size: 80mm auto; margin: 2mm;" : "size: A4; margin: 12mm;"
      } } }`}</style>

      <div className="print:hidden">
        <Link
          href="/caisse/ventes"
          className={cn(buttonVariants({ variant: "ghost" }), "mb-2 -ml-3 text-muted-foreground")}
        >
          <ArrowLeft aria-hidden />
          Ventes
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Vente {receiptNumber(sale.id)}</h1>
            <p className="text-muted-foreground">{formatDateTime(sale.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintButton autoPrint={autoPrint} />
            <Link href="/caisse" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <ShoppingCart aria-hidden />
              Nouvelle vente
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem] print:block">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1 rounded-lg border p-1 print:hidden" role="group" aria-label="Format">
            {(["ticket", "a4"] as const).map((f) => (
              <Link
                key={f}
                href={formatHref(f)}
                replace
                aria-current={format === f ? "true" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-md px-4 text-sm font-medium",
                  format === f ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {f === "ticket" ? "Ticket 80 mm" : "A4"}
              </Link>
            ))}
          </div>
          <div className="w-full overflow-x-auto rounded-xl border bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
            <Receipt sale={sale} settings={settings} format={format} />
          </div>
        </div>

        <div className="flex flex-col gap-4 print:hidden">
          {sale.status === "cancelled" && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-destructive">Vente annulée</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <p>
                  Le {sale.cancelledAt ? formatDateTime(sale.cancelledAt) : "—"} par{" "}
                  {sale.cancelledByName ?? "—"}
                </p>
                {sale.cancelReason && <p>Motif : {sale.cancelReason}</p>}
              </CardContent>
            </Card>
          )}

          {margin !== null && cost !== null && (
            <Card>
              <CardHeader>
                <CardTitle>Marge</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coût des articles</span>
                  <span className="tabular-nums">{money(cost)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Marge</span>
                  <span className={cn("tabular-nums", margin < 0 && "text-destructive")}>
                    {money(margin)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {managers && sale.status === "completed" && <CancelSale saleId={sale.id} />}
        </div>
      </div>
    </>
  );
}
