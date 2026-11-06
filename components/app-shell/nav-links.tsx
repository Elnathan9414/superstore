"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionForPath, sectionsFor, type Role, type SectionKey } from "@/lib/auth/roles";

const ICONS: Record<SectionKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  stock: Boxes,
  customers: Users,
  products: Package,
  suppliers: Truck,
  purchases: ClipboardList,
  reports: BarChart3,
  users: UserCog,
};

type NavLinksProps = {
  role: Role;
  onNavigate?: () => void;
};

export function NavLinks({ role, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const activeKey = sectionForPath(pathname)?.key;

  return (
    <nav aria-label="Navigation principale">
      <ul className="flex flex-col gap-1">
        {sectionsFor(role).map((section) => {
          const Icon = ICONS[section.key];
          const active = section.key === activeKey;
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                    : "text-sidebar-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
