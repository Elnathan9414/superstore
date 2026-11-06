import { formatDate, formatDateTime } from "@/lib/dates";
import type { SaleDetail } from "@/lib/data/sales";
import type { ShopSettings } from "@/lib/data/settings";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, receiptNumber } from "@/lib/sale";
import { cn } from "@/lib/utils";

/**
 * Printable receipt. "ticket" fits 80 mm thermal printers; "a4" is a
 * regular page. Never shows costs (only selling prices).
 */
export function Receipt({
  sale,
  settings,
  format,
}: {
  sale: SaleDetail;
  settings: ShopSettings;
  format: "ticket" | "a4";
}) {
  const money = (n: number) => formatMoney(n, settings.currency);
  const ticket = format === "ticket";

  return (
    <article
      className={cn(
        "receipt mx-auto bg-white text-black",
        ticket ? "w-[72mm] p-3 font-mono text-[12px] leading-snug" : "max-w-3xl p-8 text-sm",
      )}
      aria-label={`Ticket ${receiptNumber(sale.id)}`}
    >
      <header className={cn("flex flex-col gap-0.5", ticket ? "items-center text-center" : "mb-6")}>
        <h2 className={cn("font-bold", ticket ? "text-base" : "text-2xl")}>{settings.shopName}</h2>
        {settings.shopAddress && <p className="whitespace-pre-line">{settings.shopAddress}</p>}
        {settings.shopPhone && <p>Tél. : {settings.shopPhone}</p>}
      </header>

      <div className={cn("my-3 flex flex-col gap-0.5", ticket && "border-y border-dashed border-black py-2")}>
        <div className="flex justify-between gap-2">
          <span>{ticket ? "Ticket" : "Facture / ticket"}</span>
          <span className="font-bold">{receiptNumber(sale.id)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Date</span>
          <span>{formatDateTime(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Vendeur</span>
          <span>{sale.sellerName ?? "—"}</span>
        </div>
        {sale.customerName && (
          <div className="flex justify-between gap-2">
            <span>Client</span>
            <span className="text-right">
              {sale.customerName}
              {sale.customerPhone && ` · ${sale.customerPhone}`}
            </span>
          </div>
        )}
      </div>

      {sale.status === "cancelled" && (
        <p className="my-2 border border-black p-1 text-center font-bold uppercase">Vente annulée</p>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className={cn("text-left", ticket ? "border-b border-dashed border-black" : "border-b")}>
            <th className="py-1 font-semibold">Article</th>
            <th className="py-1 text-right font-semibold">Qté</th>
            {!ticket && <th className="py-1 text-right font-semibold">Prix unit.</th>}
            <th className="py-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="py-1 pr-2">
                <div>{item.name}</div>
                {ticket && (
                  <div className="text-[11px]">
                    {item.quantity} × {money(item.unitPrice)}
                  </div>
                )}
                {item.serials.map((s) => (
                  <div key={s.serialNumber} className="text-[11px]">
                    S/N : {s.serialNumber}
                    {s.warrantyEndsAt && ` · garantie jusqu'au ${formatDate(s.warrantyEndsAt)}`}
                  </div>
                ))}
              </td>
              <td className="py-1 text-right tabular-nums">{item.quantity}</td>
              {!ticket && <td className="py-1 text-right tabular-nums">{money(item.unitPrice)}</td>}
              <td className="py-1 text-right tabular-nums">{money(item.unitPrice * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl
        className={cn(
          "mt-3 flex flex-col gap-0.5",
          ticket ? "border-t border-dashed border-black pt-2" : "ml-auto w-72 border-t pt-3",
        )}
      >
        {sale.discount > 0 && (
          <>
            <Row label="Sous-total" value={money(sale.subtotal)} />
            <Row label="Remise" value={`− ${money(sale.discount)}`} />
          </>
        )}
        <Row label="TOTAL" value={money(sale.total)} strong />
        {sale.payments.map((p) => (
          <Row
            key={p.id}
            label={`${PAYMENT_METHOD_LABELS[p.method]}${p.reference ? ` (${p.reference})` : ""}`}
            value={money(p.amount)}
          />
        ))}
        {sale.balance > 0 && sale.status === "completed" && (
          <Row label="Reste dû" value={money(sale.balance)} strong />
        )}
      </dl>

      {settings.receiptFooter && (
        <p className={cn("mt-4 whitespace-pre-line", ticket && "text-center")}>{settings.receiptFooter}</p>
      )}
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-2", strong && "text-[1.1em] font-bold")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
