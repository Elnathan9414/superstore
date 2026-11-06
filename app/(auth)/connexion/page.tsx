import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>Connectez-vous avec votre email et votre mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* LoginForm reads the URL (?next=), which is request-time data */}
        <Suspense fallback={<div className="h-64" aria-busy />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
