import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "products", label: "Produits", href: "/produits" },
  { key: "categories", label: "Catégories", href: "/produits/categories" },
] as const;

export function ProductsTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Catalogue" className="mb-6 flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px flex min-h-11 items-center border-b-2 px-4 font-medium transition-colors",
            tab.key === active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
