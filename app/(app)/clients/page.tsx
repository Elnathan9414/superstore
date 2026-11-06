import type { Metadata } from "next";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Clients" };

export default function Page() {
  return <ComingSoon section="customers" stage={4} />;
}
