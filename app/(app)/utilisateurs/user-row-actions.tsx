"use client";

import { useState, useTransition } from "react";
import { ROLE_LABELS, ROLES, isRole, type Role } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setActive, updateRole, type ActionResult } from "./actions";

type Props = {
  userId: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

export function UserRowActions({ userId, fullName, role, isActive }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function run(action: () => Promise<ActionResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? "La modification a échoué.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select
          items={ROLE_LABELS}
          value={role}
          disabled={pending}
          onValueChange={(value) => {
            if (isRole(value) && value !== role) {
              run(() => updateRole({ userId, role: value }));
            }
          }}
        >
          <SelectTrigger className="w-40" aria-label={`Rôle de ${fullName}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={isActive ? "outline" : "default"}
          disabled={pending}
          onClick={() => {
            if (isActive && !window.confirm(`Désactiver le compte de ${fullName} ?`)) return;
            run(() => setActive({ userId, active: !isActive }));
          }}
        >
          {isActive ? "Désactiver" : "Activer"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
