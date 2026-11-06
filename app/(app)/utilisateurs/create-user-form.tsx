"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser, type CreateUserState } from "./actions";

const initialState: CreateUserState = {};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);
  // After a success, the form remounts empty (key changes with the message).
  const values = state.ok ? {} : (state.values ?? {});

  return (
    <form
      key={state.ok ? state.message : "form"}
      action={formAction}
      className="grid gap-4 md:grid-cols-2"
      noValidate
    >
      {state.message && (
        <Alert
          variant={state.ok ? "default" : "destructive"}
          role={state.ok ? "status" : "alert"}
          className="md:col-span-2"
        >
          {state.ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="off"
          defaultValue={values.fullName}
          aria-invalid={Boolean(state.errors?.fullName)}
          aria-describedby="fullName-error"
        />
        <FieldError id="fullName-error" message={state.errors?.fullName} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-email">Email</Label>
        <Input
          id="new-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          defaultValue={values.email}
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" message={state.errors?.email} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Mot de passe provisoire</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.errors?.password)}
          aria-describedby="password-hint password-error"
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          Au moins {MIN_PASSWORD_LENGTH} caractères. À communiquer à l&apos;employé.
        </p>
        <FieldError id="password-error" message={state.errors?.password} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-role">Rôle</Label>
        <Select name="role" items={ROLE_LABELS} defaultValue={values.role ?? "seller"}>
          <SelectTrigger id="new-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="role-error" message={state.errors?.role} />
      </div>

      <div className="md:col-span-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {pending ? "Création…" : "Créer le compte"}
        </Button>
      </div>
    </form>
  );
}
