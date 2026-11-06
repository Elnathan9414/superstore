import type { Metadata } from "next";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Compte inactif" };

export default function InactiveAccountPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Compte inactif</CardTitle>
        <CardDescription>
          Votre compte n&apos;est pas encore activé ou a été désactivé. Contactez le propriétaire
          de la boutique pour obtenir l&apos;accès.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Se déconnecter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
