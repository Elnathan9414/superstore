"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setProductActive } from "../actions";

export function ArchiveButton({
  productId,
  isActive,
  name,
}: {
  productId: number;
  isActive: boolean;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={isActive ? "ghost" : "default"}
        className={isActive ? "text-muted-foreground" : undefined}
        disabled={pending}
        onClick={() => {
          if (isActive && !window.confirm(`Archiver « ${name} » ? Il n'apparaîtra plus dans le stock.`)) {
            return;
          }
          setError(undefined);
          startTransition(async () => {
            const result = await setProductActive({ productId, active: !isActive });
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {isActive ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
        {isActive ? "Archiver le produit" : "Restaurer"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
