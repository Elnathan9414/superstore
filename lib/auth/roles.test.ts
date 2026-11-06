import { describe, expect, it } from "vitest";
import {
  ROLES,
  SECTIONS,
  canAccess,
  canSeeCosts,
  isRole,
  sectionForPath,
  sectionsFor,
  type SectionKey,
} from "./roles";

describe("canAccess", () => {
  const expected: Record<SectionKey, readonly string[]> = {
    dashboard: ["owner", "manager", "seller"],
    pos: ["owner", "manager", "seller"],
    stock: ["owner", "manager", "seller"],
    customers: ["owner", "manager", "seller"],
    products: ["owner", "manager"],
    suppliers: ["owner", "manager"],
    purchases: ["owner", "manager"],
    reports: ["owner", "manager"],
    users: ["owner"],
    settings: ["owner"],
  };

  for (const [section, allowed] of Object.entries(expected)) {
    for (const role of ROLES) {
      it(`${role} ${allowed.includes(role) ? "can" : "cannot"} access ${section}`, () => {
        expect(canAccess(role, section as SectionKey)).toBe(allowed.includes(role));
      });
    }
  }

  it("covers every section", () => {
    expect(SECTIONS.map((s) => s.key).sort()).toEqual(Object.keys(expected).sort());
  });
});

describe("sectionsFor", () => {
  it("gives owners every section", () => {
    expect(sectionsFor("owner")).toHaveLength(SECTIONS.length);
  });

  it("never shows sellers purchases, suppliers, reports, users or settings", () => {
    const keys = sectionsFor("seller").map((s) => s.key);
    expect(keys).not.toContain("purchases");
    expect(keys).not.toContain("suppliers");
    expect(keys).not.toContain("reports");
    expect(keys).not.toContain("users");
    expect(keys).not.toContain("settings");
  });
});

describe("canSeeCosts", () => {
  it("hides purchase prices and margins from sellers only", () => {
    expect(canSeeCosts("owner")).toBe(true);
    expect(canSeeCosts("manager")).toBe(true);
    expect(canSeeCosts("seller")).toBe(false);
  });
});

describe("isRole", () => {
  it("accepts known roles only", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("sectionForPath", () => {
  it("matches the dashboard only on /", () => {
    expect(sectionForPath("/")?.key).toBe("dashboard");
  });

  it("matches sub-paths of a section", () => {
    expect(sectionForPath("/produits")?.key).toBe("products");
    expect(sectionForPath("/produits/42/modifier")?.key).toBe("products");
  });

  it("does not match on a shared prefix", () => {
    expect(sectionForPath("/stockage")).toBeUndefined();
    expect(sectionForPath("/acces-refuse")).toBeUndefined();
  });
});
