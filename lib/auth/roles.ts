// Pure role/permission definitions. Shared by server and client code, so it
// must not import anything server-only.

export const ROLES = ["owner", "manager", "seller"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  seller: "Vendeur",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type SectionKey =
  | "dashboard"
  | "pos"
  | "products"
  | "stock"
  | "customers"
  | "suppliers"
  | "purchases"
  | "reports"
  | "users";

export type Section = {
  key: SectionKey;
  label: string;
  href: string;
  roles: readonly Role[];
};

const ALL: readonly Role[] = ROLES;
const MANAGEMENT: readonly Role[] = ["owner", "manager"];

// Order here is the order shown in the navigation.
export const SECTIONS: readonly Section[] = [
  { key: "dashboard", label: "Tableau de bord", href: "/", roles: ALL },
  { key: "pos", label: "Caisse", href: "/caisse", roles: ALL },
  { key: "stock", label: "Stock", href: "/stock", roles: ALL },
  { key: "customers", label: "Clients", href: "/clients", roles: ALL },
  { key: "products", label: "Produits", href: "/produits", roles: MANAGEMENT },
  { key: "suppliers", label: "Fournisseurs", href: "/fournisseurs", roles: MANAGEMENT },
  { key: "purchases", label: "Achats", href: "/achats", roles: MANAGEMENT },
  { key: "reports", label: "Rapports", href: "/rapports", roles: MANAGEMENT },
  { key: "users", label: "Utilisateurs", href: "/utilisateurs", roles: ["owner"] },
];

export function getSection(key: SectionKey): Section {
  const section = SECTIONS.find((s) => s.key === key);
  if (!section) throw new Error(`Unknown section: ${key}`);
  return section;
}

export function canAccess(role: Role, key: SectionKey): boolean {
  return getSection(key).roles.includes(role);
}

export function sectionsFor(role: Role): Section[] {
  return SECTIONS.filter((s) => s.roles.includes(role));
}

/** Only owners and managers may see purchase prices and margins. */
export function canSeeCosts(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/**
 * Returns the section matching a pathname ("/" only matches the dashboard,
 * other sections match their href and any sub-path).
 */
export function sectionForPath(pathname: string): Section | undefined {
  if (pathname === "/") return getSection("dashboard");
  return SECTIONS.find(
    (s) => s.href !== "/" && (pathname === s.href || pathname.startsWith(`${s.href}/`)),
  );
}
