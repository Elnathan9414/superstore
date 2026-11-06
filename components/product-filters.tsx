import Link from "next/link";
import { Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProductFilterValues = {
  q?: string;
  categorie?: string;
  filtre?: string;
};

type Props = {
  basePath: string;
  values: ProductFilterValues;
  categories: { id: number; name: string }[];
  /** Extra status filters, e.g. { bas: "Stock bas", archives: "Archivés" } */
  statusOptions: Record<string, string>;
};

/**
 * Plain GET form: works without JavaScript and keeps filters in the URL
 * (shareable, back button friendly). The search field accepts barcode
 * scanners, which type the code and press Enter.
 */
export function ProductFilters({ basePath, values, categories, statusOptions }: Props) {
  const categoryItems: Record<string, string> = { tous: "Toutes les catégories" };
  for (const c of categories) categoryItems[String(c.id)] = c.name;
  const statusItems: Record<string, string> = { tous: "Tous", ...statusOptions };
  const hasFilters = Boolean(values.q || values.categorie || values.filtre);

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      className="mb-4 grid gap-3 md:grid-cols-[1fr_14rem_12rem_auto] md:items-end"
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          name="q"
          type="search"
          defaultValue={values.q}
          placeholder="Nom, SKU, code-barres, marque…"
          aria-label="Rechercher un produit"
          className="pl-10"
          autoComplete="off"
        />
      </div>
      <Select name="categorie" items={categoryItems} defaultValue={values.categorie ?? "tous"}>
        <SelectTrigger className="w-full" aria-label="Catégorie">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(categoryItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select name="filtre" items={statusItems} defaultValue={values.filtre ?? "tous"}>
        <SelectTrigger className="w-full" aria-label="Filtre">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button type="submit">Filtrer</Button>
        {hasFilters && (
          <Link href={basePath} className={buttonVariants({ variant: "ghost" })}>
            Effacer
          </Link>
        )}
      </div>
    </form>
  );
}

/** Reads and normalizes the filter search params. */
export function readProductFilters(
  params: Record<string, string | string[] | undefined>,
  allowedStatus: readonly string[],
) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = first(params.q)?.trim() || undefined;
  const categorieRaw = first(params.categorie);
  const categorie = categorieRaw && /^\d+$/.test(categorieRaw) ? categorieRaw : undefined;
  const filtreRaw = first(params.filtre);
  const filtre = filtreRaw && allowedStatus.includes(filtreRaw) ? filtreRaw : undefined;
  return { q, categorie, filtre };
}
