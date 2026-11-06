"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, LoaderCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelSale } from "../../actions";

/** Print button; prints automatically once when arriving from the till. */
export function PrintButton({ autoPrint }: { autoPrint: boolean }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!autoPrint || done.current) return;
    done.current = true;
    // Let the receipt render, then open the print dialog. Drop ?imprimer=1
    // so a refresh does not print again.
    const timer = setTimeout(() => {
      window.print();
      router.replace(window.location.pathname + window.location.search.replace(/[?&]imprimer=1/, ""));
    }, 300);
    return () => clearTimeout(timer);
  }, [autoPrint, router]);

  return (
    <Button size="lg" onClick={() => window.print()}>
      <Printer aria-hidden />
      Imprimer
    </Button>
  );
}

export function CancelSale({ saleId }: { saleId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="destructive" size="lg" onClick={() => setOpen(true)}>
        <Ban aria-hidden />
        Annuler la vente
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-destructive/40 p-4">
      <p className="text-sm">
        Les articles reviennent en stock et les numéros de série redeviennent disponibles. Pensez à
        rembourser le client.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cancel-reason">Motif de l&apos;annulation</Label>
        <Input
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          autoFocus
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
          Retour
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const result = await cancelSale({ saleId, reason });
              if (result.ok) setOpen(false);
              else setError(result.message);
            })
          }
        >
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          Confirmer l&apos;annulation
        </Button>
      </div>
    </div>
  );
}
