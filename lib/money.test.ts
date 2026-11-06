import { describe, expect, it } from "vitest";
import { currencyLabel, formatMoney, moneyToInput, parseMoney } from "./money";

const XAF = { code: "XAF", decimals: 0 };
const EUR = { code: "EUR", decimals: 2 };
// Intl uses narrow no-break spaces in fr-FR; normalize for readable asserts
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("parseMoney (no decimals, XAF)", () => {
  it.each([
    ["150000", 150000],
    ["150 000", 150000],
    ["150 000", 150000],
    ["150.000", 150000],
    ["1.500.000", 1500000],
    ["1,500,000", 1500000],
    ["0", 0],
    ["  25000 ", 25000],
  ])("parses %j", (input, expected) => {
    expect(parseMoney(input, 0)).toBe(expected);
  });

  it.each([[""], ["abc"], ["-500"], ["12,5"], ["1.50"], ["15 000,50"], ["1e6"]])(
    "rejects %j",
    (input) => {
      expect(parseMoney(input, 0)).toBeNull();
    },
  );

  it("rejects amounts beyond safe integers", () => {
    expect(parseMoney("99999999999999999999", 0)).toBeNull();
  });
});

describe("parseMoney (2 decimals)", () => {
  it.each([
    ["12,50", 1250],
    ["12.5", 1250],
    ["12", 1200],
    ["1 234,56", 123456],
    ["0,07", 7],
    ["12,", 1200],
  ])("parses %j without floating point errors", (input, expected) => {
    expect(parseMoney(input, 2)).toBe(expected);
  });

  it("rejects too many decimals", () => {
    expect(parseMoney("12,345", 2)).toBeNull();
  });

  it("gives exact cents where floats would not (0.1 + 0.2)", () => {
    expect((parseMoney("0,1", 2) ?? 0) + (parseMoney("0,2", 2) ?? 0)).toBe(30);
  });
});

describe("formatMoney", () => {
  it("formats FCFA without decimals", () => {
    expect(plain(formatMoney(1500000, XAF))).toBe("1 500 000 FCFA");
  });

  it("formats euros from cents", () => {
    expect(plain(formatMoney(123456, EUR))).toBe("1 234,56 €");
  });
});

describe("moneyToInput", () => {
  it("round-trips with parseMoney", () => {
    for (const [amount, decimals] of [
      [150000, 0],
      [1250, 2],
      [7, 2],
      [0, 2],
    ] as const) {
      expect(parseMoney(moneyToInput(amount, decimals), decimals)).toBe(amount);
    }
  });

  it("pads small amounts", () => {
    expect(moneyToInput(7, 2)).toBe("0,07");
  });
});

describe("currencyLabel", () => {
  it("uses the French symbol", () => {
    expect(currencyLabel({ code: "XAF", decimals: 0 })).toBe("FCFA");
    expect(currencyLabel({ code: "EUR", decimals: 2 })).toBe("€");
  });
});
