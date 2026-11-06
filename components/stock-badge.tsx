import { Badge } from "@/components/ui/badge";
import { STOCK_LEVEL_LABELS, stockLevel } from "@/lib/stock";
import { cn } from "@/lib/utils";

const STYLES = {
  out: "bg-destructive/10 text-destructive",
  low: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
} as const;

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const level = stockLevel(stock, minStock);
  return (
    <Badge variant="secondary" className={cn("gap-1 tabular-nums", STYLES[level])}>
      <span className="font-semibold">{stock}</span>
      <span className="font-normal">· {STOCK_LEVEL_LABELS[level]}</span>
    </Badge>
  );
}
