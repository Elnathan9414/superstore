import { Store } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 p-4">
      <div className="flex items-center gap-3 text-xl font-semibold">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="size-6" aria-hidden />
        </span>
        Boutique
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
