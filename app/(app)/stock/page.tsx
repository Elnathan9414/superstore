import type { Metadata } from "next";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Stock" };

export default function Page() {
  return <ComingSoon section="stock" stage={2} />;
}
