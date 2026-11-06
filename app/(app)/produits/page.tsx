import type { Metadata } from "next";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Produits" };

export default function Page() {
  return <ComingSoon section="products" stage={2} />;
}
