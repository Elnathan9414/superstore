import { describe, expect, it } from "vitest";
import { cleanSearch, ilikeAny, pageParam } from "./search";

describe("cleanSearch", () => {
  it("keeps normal text", () => {
    expect(cleanSearch("  iPhone 15  Pro ")).toBe("iPhone 15 Pro");
  });

  it("strips PostgREST filter syntax", () => {
    expect(cleanSearch("a,b(c)\"d\\e*f%g:h")).toBe("a b c d e f g h");
    expect(cleanSearch("x),id.gt.(0")).toBe("x id.gt. 0");
  });

  it("returns null for empty input", () => {
    expect(cleanSearch("")).toBeNull();
    expect(cleanSearch(" ,() ")).toBeNull();
    expect(cleanSearch(undefined)).toBeNull();
  });

  it("limits the length", () => {
    expect(cleanSearch("a".repeat(500))?.length).toBe(100);
  });
});

describe("ilikeAny", () => {
  it("builds an or filter", () => {
    expect(ilikeAny(["name", "sku"], "abc")).toBe("name.ilike.*abc*,sku.ilike.*abc*");
  });
});

describe("pageParam", () => {
  it.each([
    [undefined, 1],
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["abc", 1],
    ["1.5", 1],
    [["4", "5"], 4],
  ] as const)("%j -> %i", (input, expected) => {
    expect(pageParam(input as string | string[] | undefined)).toBe(expected);
  });
});
