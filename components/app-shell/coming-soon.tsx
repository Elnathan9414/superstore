import { Construction } from "lucide-react";
import { getSection, type SectionKey } from "@/lib/auth/roles";
import { requireSection } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "./page-header";

/** Placeholder for modules delivered in later stages (see SPEC.md). */
export async function ComingSoon({ section, stage }: { section: SectionKey; stage: number }) {
  await requireSection(section);
  const { label } = getSection(section);

  return (
    <>
      <PageHeader title={label} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Construction className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-lg font-medium">Bientôt disponible</p>
          <p className="text-muted-foreground">Ce module arrive à l&apos;étape {stage}.</p>
        </CardContent>
      </Card>
    </>
  );
}
