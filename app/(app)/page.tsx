import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { ROLE_LABELS, sectionsFor } from "@/lib/auth/roles";
import { requireSection } from "@/lib/auth/session";
import { countLowStock } from "@/lib/data/catalog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function DashboardPage() {
  const profile = await requireSection("dashboard");
  const shortcuts = sectionsFor(profile.role).filter((s) => s.key !== "dashboard");
  const lowStock = await countLowStock();

  return (
    <>
      <PageHeader
        title={`Bonjour, ${profile.fullName}`}
        description={`Connecté en tant que ${ROLE_LABELS[profile.role].toLowerCase()}.`}
      />
      {lowStock > 0 && (
        <Link
          href="/stock?filtre=bas"
          className="mb-6 flex min-h-14 items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 transition-colors hover:bg-amber-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 font-medium">
            {lowStock} produit{lowStock > 1 ? "s" : ""} en stock bas ou en rupture
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex min-h-20 flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-lg">{section.label}</CardTitle>
                  <CardDescription>Ouvrir le module</CardDescription>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
