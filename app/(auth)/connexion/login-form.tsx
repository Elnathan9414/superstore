"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const next = useSearchParams().get("next") ?? "/";

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.message && (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby={state.errors?.email ? "email-error" : undefined}
        />
        {state.errors?.email && (
          <p id="email-error" className="text-sm text-destructive">
            {state.errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.errors?.password)}
          aria-describedby={state.errors?.password ? "password-error" : undefined}
        />
        {state.errors?.password && (
          <p id="password-error" className="text-sm text-destructive">
            {state.errors.password}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <LoaderCircle className="animate-spin" aria-hidden />}
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
