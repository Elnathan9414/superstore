"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Landmark,
  LoaderCircle,
  Minus,
  Plus,
  ScanBarcode,
  Search,
  Smartphone,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CustomerLite } from "@/lib/data/sales";
import { currencyLabel, formatMoney, moneyToInput, parseMoney, type Currency } from "@/lib/money";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  cashChange,
  checkSale,
  discountAmount,
  maxDiscountFor,
  subtotalOf,
  type Discount,
  type PaymentMethod,
  type SaleIssue,
} from "@/lib/sale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkout, searchPos, type PosProduct, type PosSerial } from "./actions";
import { CustomerPicker } from "./customer-picker";
import { SerialPicker } from "./serial-picker";

type CartLine = {
  product: PosProduct;
  quantity: number;
  /** Tracked products only: exact units sold (quantity = serials.length) */
  serials: PosSerial[];
};

type PaymentRow = {
  key: number;
  method: PaymentMethod;
  amountText: string;
  reference: string;
};

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  mobile_money: Smartphone,
  card: CreditCard,
  transfer: Landmark,
};

const ISSUE_MESSAGES: Record<SaleIssue, string> = {
  empty_cart: "Ajoutez au moins un article.",
  invalid_discount: "Remise invalide.",
  discount_too_high: "Remise supérieure au plafond autorisé.",
  overpayment: "Le montant payé dépasse le total.",
  invalid_payment: "Un montant de paiement est invalide.",
  customer_required: "Choisissez un client : la vente n'est pas soldée (crédit).",
};

type Props = {
  currency: Currency;
  /** Seller discount cap in %, null for managers/owners */
  discountCapPercent: number | null;
};

export function PointOfSale({ currency, discountCapPercent }: Props) {
  const router = useRouter();
  const money = (amount: number) => formatMoney(amount, currency);

  const [clientRef] = useState(() => crypto.randomUUID());
  const [lines, setLines] = useState<CartLine[]>([]);
  const [pickerFor, setPickerFor] = useState<PosProduct | null>(null);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountText, setDiscountText] = useState("");
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [cashGivenText, setCashGivenText] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const [submitting, startSubmit] = useTransition();
  const nextKey = useRef(1);

  // ----- Totals (same rules as the database) -----
  const saleLines = lines.map((l) => ({ unitPrice: l.product.salePrice, quantity: l.quantity }));
  const subtotal = subtotalOf(saleLines);

  let discount: Discount = null;
  let discountInvalid = false;
  if (discountText.trim()) {
    const value =
      discountType === "amount"
        ? parseMoney(discountText, currency.decimals)
        : /^\d{1,3}$/.test(discountText.trim())
          ? Number(discountText.trim())
          : null;
    if (value === null) discountInvalid = true;
    else discount = { type: discountType, value };
  }
  const discountValue = discountInvalid ? null : discountAmount(subtotal, discount);
  const total = subtotal - (discountValue ?? 0);

  const parsedPayments = payments.map((p) => ({
    ...p,
    amount: parseMoney(p.amountText, currency.decimals),
  }));
  const paymentsValid = parsedPayments.every((p) => p.amount !== null && p.amount > 0);
  const paid = parsedPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const balance = total - paid;
  const cashDue = parsedPayments
    .filter((p) => p.method === "cash")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const cashGiven = parseMoney(cashGivenText, currency.decimals);

  const issue: SaleIssue | null =
    discountInvalid || discountValue === null
      ? "invalid_discount"
      : !paymentsValid
        ? "invalid_payment"
        : checkSale({
            lines: saleLines,
            discount,
            payments: parsedPayments.map((p) => ({ method: p.method, amount: p.amount ?? 0 })),
            hasCustomer: customer !== null,
            discountCapPercent,
          });

  // ----- Cart operations -----
  function flash(message: string) {
    setNotice(message);
  }

  function addProduct(product: PosProduct) {
    setServerError(undefined);
    if (product.tracksSerial) {
      setPickerFor(product);
      return;
    }
    const current = lines.find((l) => l.product.id === product.id)?.quantity ?? 0;
    if (current + 1 > product.stock) {
      flash(`Stock insuffisant pour ${product.name} (${product.stock} en stock).`);
      return;
    }
    setLines((prev) =>
      prev.some((l) => l.product.id === product.id)
        ? prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, { product, quantity: 1, serials: [] }],
    );
    setNotice(undefined);
  }

  function addUnit(product: PosProduct, unit: PosSerial) {
    setServerError(undefined);
    const line = lines.find((l) => l.product.id === product.id);
    if (line?.serials.some((s) => s.id === unit.id)) {
      flash(`${unit.serialNumber} est déjà dans le panier.`);
      return;
    }
    setLines((prev) =>
      line
        ? prev.map((l) =>
            l.product.id === product.id
              ? { ...l, serials: [...l.serials, unit], quantity: l.serials.length + 1 }
              : l,
          )
        : [...prev, { product, quantity: 1, serials: [unit] }],
    );
    setNotice(undefined);
  }

  function setSerials(product: PosProduct, serials: PosSerial[]) {
    setLines((prev) => {
      const exists = prev.some((l) => l.product.id === product.id);
      if (serials.length === 0) return prev.filter((l) => l.product.id !== product.id);
      const updated = { product, serials, quantity: serials.length };
      return exists
        ? prev.map((l) => (l.product.id === product.id ? updated : l))
        : [...prev, updated];
    });
    setPickerFor(null);
  }

  function changeQuantity(productId: number, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          const quantity = Math.min(l.product.stock, l.quantity + delta);
          return { ...l, quantity };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(productId: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }

  // ----- Payments -----
  function addPayment(method: PaymentMethod) {
    const remaining = Math.max(0, balance);
    setPayments((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        method,
        amountText: remaining > 0 ? moneyToInput(remaining, currency.decimals) : "",
        reference: "",
      },
    ]);
  }

  function updatePayment(key: number, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  // ----- Submit -----
  function submit() {
    if (issue) return;
    setServerError(undefined);
    startSubmit(async () => {
      const result = await checkout({
        clientRef,
        customerId: customer?.id ?? null,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          serialIds: l.serials.map((s) => s.id),
        })),
        discount: discount && discount.value > 0 ? discount : null,
        payments: parsedPayments.map((p) => ({
          method: p.method,
          amount: p.amount ?? 0,
          reference: p.reference.trim() || null,
        })),
        expectedTotal: total,
        notes: notes.trim() || null,
      });
      if (result.ok) {
        router.push(`/caisse/ventes/${result.saleId}?imprimer=1`);
      } else {
        setServerError(result.message);
      }
    });
  }

  const pickerSelected = pickerFor
    ? (lines.find((l) => l.product.id === pickerFor.id)?.serials ?? [])
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
      {/* ---------- Left: search + cart ---------- */}
      <div className="flex min-w-0 flex-col gap-4">
        <ProductSearch onAdd={addProduct} onAddUnit={addUnit} onNotice={flash} />
        {notice && (
          <p
            role="status"
            className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"
          >
            {notice}
            <button type="button" aria-label="Fermer" onClick={() => setNotice(undefined)}>
              <X className="size-4" aria-hidden />
            </button>
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Panier</CardTitle>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Scannez un code-barres ou un IMEI, ou recherchez un produit.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {lines.map((line) => (
                  <li key={line.product.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{line.product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {line.product.sku} · {money(line.product.salePrice)}
                        </div>
                      </div>
                      <div className="text-right font-semibold tabular-nums">
                        {money(line.product.salePrice * line.quantity)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {line.product.tracksSerial ? (
                        <>
                          <div className="flex flex-1 flex-wrap gap-1.5">
                            {line.serials.map((s) => (
                              <Badge key={s.id} variant="outline" className="h-7 font-mono">
                                {s.serialNumber}
                              </Badge>
                            ))}
                          </div>
                          <Button variant="outline" onClick={() => setPickerFor(line.product)}>
                            N° de série ({line.quantity})
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-1 items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Retirer un ${line.product.name}`}
                            onClick={() => changeQuantity(line.product.id, -1)}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <span className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                            {line.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Ajouter un ${line.product.name}`}
                            disabled={line.quantity >= line.product.stock}
                            onClick={() => changeQuantity(line.product.id, 1)}
                          >
                            <Plus aria-hidden />
                          </Button>
                          <span className="text-sm text-muted-foreground">/ {line.product.stock} en stock</span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer ${line.product.name} du panier`}
                        onClick={() => removeLine(line.product.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Right: totals, customer, payments ---------- */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total</span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="discount">
                Remise
                {discountCapPercent !== null && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (max {discountCapPercent} % · {money(maxDiscountFor(subtotal, discountCapPercent))})
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="discount"
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  aria-invalid={issue === "invalid_discount" || issue === "discount_too_high" || undefined}
                />
                <div className="flex rounded-lg border p-0.5" role="group" aria-label="Type de remise">
                  {(["amount", "percent"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={discountType === t}
                      onClick={() => setDiscountType(t)}
                      className={cn(
                        "min-h-10 min-w-12 rounded-md px-2 text-sm font-medium",
                        discountType === t ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {t === "amount" ? currencyLabel(currency) : "%"}
                    </button>
                  ))}
                </div>
              </div>
              {discountValue !== null && discountValue > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Remise appliquée</span>
                  <span className="tabular-nums">− {money(discountValue)}</span>
                </div>
              )}
            </div>

            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-3xl font-bold tabular-nums">{money(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerPicker
              customer={customer}
              onChange={setCustomer}
              required={balance > 0 && lines.length > 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paiement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICONS[m];
                return (
                  <Button key={m} variant="outline" onClick={() => addPayment(m)} disabled={lines.length === 0}>
                    <Icon aria-hidden />
                    {PAYMENT_METHOD_LABELS[m]}
                  </Button>
                );
              })}
            </div>

            {payments.length > 0 && (
              <ul className="flex flex-col gap-3">
                {parsedPayments.map((p) => (
                  <li key={p.key} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{PAYMENT_METHOD_LABELS[p.method]}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer le paiement ${PAYMENT_METHOD_LABELS[p.method]}`}
                        onClick={() => setPayments((prev) => prev.filter((x) => x.key !== p.key))}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                    <Input
                      value={p.amountText}
                      onChange={(e) => updatePayment(p.key, { amountText: e.target.value })}
                      inputMode="decimal"
                      aria-label={`Montant ${PAYMENT_METHOD_LABELS[p.method]}`}
                      aria-invalid={p.amount === null || p.amount <= 0 || undefined}
                      className="text-lg tabular-nums"
                    />
                    {p.method !== "cash" && (
                      <Input
                        value={p.reference}
                        onChange={(e) => updatePayment(p.key, { reference: e.target.value })}
                        placeholder="Référence de transaction (facultatif)"
                        aria-label={`Référence ${PAYMENT_METHOD_LABELS[p.method]}`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {cashDue > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="cash-given">Espèces remises par le client</Label>
                <Input
                  id="cash-given"
                  value={cashGivenText}
                  onChange={(e) => setCashGivenText(e.target.value)}
                  inputMode="decimal"
                  className="text-lg tabular-nums"
                />
                {cashGiven !== null && cashGiven > 0 && (
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Monnaie à rendre</span>
                    <span className="tabular-nums">{money(cashChange(cashGiven, cashDue))}</span>
                  </div>
                )}
              </div>
            )}

            <dl className="flex flex-col gap-1 border-t pt-3">
              <div className="flex justify-between">
                <dt>Payé</dt>
                <dd className="tabular-nums">{money(paid)}</dd>
              </div>
              <div className={cn("flex justify-between font-semibold", balance > 0 && "text-amber-700 dark:text-amber-300")}>
                <dt>{balance > 0 ? "Reste dû (crédit)" : "Reste à payer"}</dt>
                <dd className="tabular-nums">{money(Math.max(0, balance))}</dd>
              </div>
            </dl>

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note sur la vente (facultatif)"
              aria-label="Note sur la vente"
              rows={2}
            />

            {(serverError || (issue && lines.length > 0)) && (
              <p role="alert" className="text-sm text-destructive">
                {serverError ?? (issue ? ISSUE_MESSAGES[issue] : null)}
              </p>
            )}

            <Button size="lg" className="h-14 text-lg" disabled={Boolean(issue) || submitting} onClick={submit}>
              {submitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Encaisser {lines.length > 0 && money(total)}
            </Button>
          </CardContent>
        </Card>
      </div>

      <SerialPicker
        product={pickerFor}
        selected={pickerSelected}
        onClose={() => setPickerFor(null)}
        onConfirm={setSerials}
      />
    </div>
  );
}

// ---------- Product search ----------

function ProductSearch({
  onAdd,
  onAddUnit,
  onNotice,
}: {
  onAdd: (product: PosProduct) => void;
  onAddUnit: (product: PosProduct, unit: PosSerial) => void;
  onNotice: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  // Debounced search while typing (results list)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchPos(q);
        if (id === requestId.current) setResults(r.products);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Enter (typed or sent by a barcode scanner): add the exact match directly
  async function onEnter() {
    const q = query.trim();
    if (!q) return;
    const id = ++requestId.current;
    setSearching(true);
    try {
      const r = await searchPos(q);
      if (id !== requestId.current) return;
      if (r.serial) {
        onAddUnit(r.serial.product, r.serial.unit);
        reset();
      } else if (r.exact) {
        onAdd(r.exact);
        reset();
      } else if (r.products.length === 1) {
        onAdd(r.products[0]);
        reset();
      } else {
        setResults(r.products);
        if (r.products.length === 0) onNotice(`Aucun produit ni IMEI en stock pour « ${q} ».`);
      }
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }

  function reset() {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  const shown = query.trim().length >= 2 ? results : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <ScanBarcode
          className="pointer-events-none absolute top-1/2 left-3 size-6 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onEnter();
            }
          }}
          placeholder="Scanner ou rechercher : nom, SKU, code-barres, IMEI"
          aria-label="Rechercher un produit ou scanner un code"
          className="h-14 pl-12 text-lg md:text-lg"
          autoComplete="off"
          autoFocus
        />
        {searching && (
          <LoaderCircle
            className="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
      {shown.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Résultats">
          {shown.map((p) => {
            const out = p.stock <= 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={out}
                  onClick={() => {
                    onAdd(p);
                    reset();
                  }}
                  className="flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="line-clamp-2 font-medium">{p.name}</span>
                  <span className="flex w-full justify-between gap-2 text-sm text-muted-foreground">
                    <span>{p.sku}</span>
                    <span>{out ? "Rupture" : `${p.stock} en stock`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {query.trim().length >= 2 && !searching && shown.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="size-4" aria-hidden />
          Appuyez sur Entrée pour rechercher.
        </p>
      )}
    </div>
  );
}
