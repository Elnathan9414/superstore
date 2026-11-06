import type { Metadata } from "next";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Achats" };

export default function Page() {
  return <ComingSoon section="purchases" stage={4} />;
}
