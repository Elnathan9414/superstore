import { Suspense } from "react";
import { AppShell, AppShellFallback } from "@/components/app-shell/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // The shell reads the session cookie (request-time data), so with Cache
    // Components it must stream in behind a Suspense boundary.
    <Suspense fallback={<AppShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
