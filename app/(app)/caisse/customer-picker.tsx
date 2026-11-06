"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, UserPlus, UserRound, X } from "lucide-react";
import type { CustomerLite } from "@/lib/data/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuickCustomer, findCustomers } from "./actions";

type Props = {
  customer: CustomerLite | null;
  onChange: (customer: CustomerLite | null) => void;
  required: boolean;
};

export function CustomerPicker({ customer, onChange, required }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerLite[]>([]);
  const [creating, setCreating] = useState(false);

  // Debounced search while typing
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      findCustomers(q)
        .then((list) => !cancelled && setResults(list))
        .catch(() => !cancelled && setResults([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (customer) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2">
        <UserRound className="size-5 text-muted-foreground" aria-hidden />
        <div className="flex-1">
          <div className="font-medium">{customer.fullName}</div>
          {customer.phone && <div className="text-sm text-muted-foreground">{customer.phone}</div>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Retirer le client" onClick={() => onChange(null)}>
          <X aria-hidden />
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <QuickCreate
        initialName={query}
        onCancel={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          setQuery("");
          onChange(c);
        }}
      />
    );
  }

  const shown = query.trim().length >= 2 ? results : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={required ? "Client obligatoire (crédit)" : "Client (facultatif)"}
          aria-label="Rechercher un client par nom ou téléphone"
          aria-invalid={required || undefined}
        />
        <Button variant="outline" size="icon" aria-label="Nouveau client" onClick={() => setCreating(true)}>
          <UserPlus aria-hidden />
        </Button>
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-col rounded-lg border">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setQuery("");
                }}
                className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="font-medium">{c.fullName}</span>
                {c.phone && <span className="text-sm text-muted-foreground">{c.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickCreate({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (c: CustomerLite) => void;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qc-name">Nom du client</Label>
        <Input
          id="qc-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          aria-invalid={Boolean(errors.fullName) || undefined}
          autoFocus
        />
        {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qc-phone">Téléphone</Label>
        <Input
          id="qc-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          aria-invalid={Boolean(errors.phone) || undefined}
        />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
      </div>
      {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await createQuickCustomer({ fullName, phone });
              if (result.ok) onCreated(result.customer);
              else setErrors(result.errors);
            })
          }
        >
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          Créer
        </Button>
      </div>
    </div>
  );
}
