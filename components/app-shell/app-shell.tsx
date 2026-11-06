import Link from "next/link";
import { Store } from "lucide-react";
import { requireActiveProfile } from "@/lib/auth/session";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

function Brand() {
  return (
    <Link
      href="/"
      className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-lg font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store className="size-5" aria-hidden />
      </span>
      Boutique
    </Link>
  );
}

/**
 * Authenticated layout. Reads the session, so it must render inside a
 * <Suspense> boundary (see app/(app)/layout.tsx).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await requireActiveProfile();

  return (
    <div className="flex min-h-dvh">
      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavLinks role={profile.role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
          {/* Tablet / small screens: drawer */}
          <MobileNav role={profile.role} />
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto">
            <UserMenu fullName={profile.fullName} email={profile.email} role={profile.role} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShellFallback() {
  return (
    <div className="flex min-h-dvh" aria-busy aria-label="Chargement">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-16 border-b" />
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
