import { describe, expect, it } from "vitest";
import { isPublicPath, safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirectPath("/caisse")).toBe("/caisse");
    expect(safeRedirectPath("/produits?q=iphone")).toBe("/produits?q=iphone");
  });

  it.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["https://evil.com"],
    ["evil.com"],
    ["javascript:alert(1)"],
    ["/ok\\..\\evil"],
    ["/a\nb"],
    [""],
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });

  it("rejects non-strings and uses the fallback", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined, "/caisse")).toBe("/caisse");
  });

  it("does not loop back to the login page", () => {
    expect(safeRedirectPath("/connexion")).toBe("/");
    expect(safeRedirectPath("/connexion?next=/")).toBe("/");
  });
});

describe("isPublicPath", () => {
  it("only exposes the login page", () => {
    expect(isPublicPath("/connexion")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/utilisateurs")).toBe(false);
    expect(isPublicPath("/connexionx")).toBe(false);
  });
});
