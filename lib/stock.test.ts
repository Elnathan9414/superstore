import { describe, expect, it } from "vitest";
import { checkSerials, findDuplicates, parseSerials, stockFromMovements, stockLevel } from "./stock";

describe("stockFromMovements", () => {
  it("is the sum of signed movements", () => {
    expect(
      stockFromMovements([
        { quantity: 10 }, // entry
        { quantity: -3 }, // sale
        { quantity: 1 }, // return
        { quantity: -2 }, // adjustment (loss)
      ]),
    ).toBe(6);
  });

  it("is zero without movements", () => {
    expect(stockFromMovements([])).toBe(0);
  });
});

describe("stockLevel", () => {
  it.each([
    [0, 5, "out"],
    [-1, 0, "out"],
    [3, 5, "low"],
    [5, 5, "low"],
    [6, 5, "ok"],
    [1, 0, "ok"],
  ] as const)("stock %i with minimum %i is %s", (stock, min, expected) => {
    expect(stockLevel(stock, min)).toBe(expected);
  });
});

describe("parseSerials", () => {
  it("splits lines, commas, semicolons and tabs, trims and drops blanks", () => {
    expect(parseSerials(" 3567 \r\n\n3568, 3569;3570\t3571 ")).toEqual([
      "3567",
      "3568",
      "3569",
      "3570",
      "3571",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseSerials("  \n ")).toEqual([]);
  });
});

describe("checkSerials", () => {
  it("accepts one distinct serial per unit", () => {
    expect(checkSerials(["A", "B"], 2)).toEqual({ ok: true });
  });

  it("rejects a count mismatch", () => {
    expect(checkSerials(["A"], 2)).toEqual({
      ok: false,
      error: "count_mismatch",
      expected: 2,
      actual: 1,
    });
  });

  it("reports duplicates first", () => {
    expect(checkSerials(["A", "A", "B"], 3)).toEqual({
      ok: false,
      error: "duplicates",
      duplicates: ["A"],
    });
  });

  it("findDuplicates lists each duplicate once", () => {
    expect(findDuplicates(["x", "y", "x", "x", "y", "z"])).toEqual(["x", "y"]);
  });
});
