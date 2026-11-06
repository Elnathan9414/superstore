import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  /** Current search params, without "page" */
  params: Record<string, string | undefined>;
  basePath: string;
};

function href(basePath: string, params: Props["params"], page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ page, pageSize, total, params, basePath }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const linkClass = buttonVariants({ variant: "outline", size: "icon" });
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="flex items-center justify-between gap-4 pt-4 text-sm text-muted-foreground">
      <span>
        {first}–{last} sur {total}
      </span>
      <div className="flex gap-2">
        <Link
          href={href(basePath, params, page - 1)}
          aria-label="Page précédente"
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(linkClass, page <= 1 && disabled)}
        >
          <ChevronLeft aria-hidden />
        </Link>
        <Link
          href={href(basePath, params, page + 1)}
          aria-label="Page suivante"
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={cn(linkClass, page >= pages && disabled)}
        >
          <ChevronRight aria-hidden />
        </Link>
      </div>
    </div>
  );
}
