import type { Metadata } from "next";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Fournisseurs" };

export default function Page() {
  return <ComingSoon section="suppliers" stage={4} />;
}
