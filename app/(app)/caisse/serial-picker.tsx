"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { listAvailableSerials, type PosProduct, type PosSerial } from "./actions";

type Props = {
  product: PosProduct | null;
  selected: PosSerial[];
  onClose: () => void;
  onConfirm: (product: PosProduct, serials: PosSerial[]) => void;
};

/** Pick the exact units (IMEI / serial numbers) sold for a tracked product. */
export function SerialPicker({ product, selected, onClose, onConfirm }: Props) {
  return (
    <Sheet open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full p-4 data-[side=right]:sm:max-w-md">
        {product && (
          <PickerBody
            key={product.id}
            product={product}
            initial={selected}
            onCancel={onClose}
            onConfirm={(serials) => onConfirm(product, serials)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PickerBody({
  product,
  initial,
  onCancel,
  onConfirm,
}: {
  product: PosProduct;
  initial: PosSerial[];
  onCancel: () => void;
  onConfirm: (serials: PosSerial[]) => void;
}) {
  const [units, setUnits] = useState<PosSerial[] | null>(null);
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Map<number, PosSerial>>(
    () => new Map(initial.map((s) => [s.id, s])),
  );

  useEffect(() => {
    let cancelled = false;
    listAvailableSerials(product.id)
      .then((list) => !cancelled && setUnits(list))
      .catch(() => !cancelled && setError("Impossible de charger les unités en stock."));
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (units ?? []).filter((u) => !f || u.serialNumber.toLowerCase().includes(f));
  }, [units, filter]);

  function toggle(unit: PosSerial) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(unit.id)) next.delete(unit.id);
      else next.set(unit.id, unit);
      return next;
    });
  }

  return (
    <>
      <SheetHeader className="p-0">
        <SheetTitle className="text-lg">{product.name}</SheetTitle>
        <SheetDescription>Choisissez ou scannez les numéros de série vendus.</SheetDescription>
      </SheetHeader>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            // A scanner types the IMEI then Enter: select the exact match
            if (e.key !== "Enter") return;
            e.preventDefault();
            const match = units?.find((u) => u.serialNumber === filter.trim());
            if (match) {
              setPicked((prev) => new Map(prev).set(match.id, match));
              setFilter("");
            }
          }}
          placeholder="Filtrer ou scanner un IMEI"
          aria-label="Filtrer ou scanner un numéro de série"
          className="pl-10 font-mono"
          autoFocus
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="text-destructive">{error}</p>}
        {!units && !error && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        )}
        {units && units.length === 0 && <p className="text-muted-foreground">Aucune unité en stock.</p>}
        <ul className="flex flex-col gap-2">
          {visible.map((u) => {
            const isPicked = picked.has(u.id);
            return (
              <li key={u.id}>
                <label
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 font-mono",
                    isPicked && "border-primary bg-primary/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isPicked}
                    onChange={() => toggle(u)}
                    className="size-5 accent-primary"
                  />
                  {u.serialNumber}
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <SheetFooter className="flex-row gap-2 p-0">
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel}>
          Annuler
        </Button>
        <Button size="lg" className="flex-1" onClick={() => onConfirm([...picked.values()])}>
          Valider ({picked.size})
        </Button>
      </SheetFooter>
    </>
  );
}
