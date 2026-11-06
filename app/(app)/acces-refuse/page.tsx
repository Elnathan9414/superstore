import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Accès refusé" };

export default function ForbiddenPage() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <ShieldX className="size-10 text-destructive" aria-hidden />
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="text-muted-foreground">
          Votre rôle ne permet pas d&apos;accéder à cette page.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
          Retour au tableau de bord
        </Link>
      </CardContent>
    </Card>
  );
}
