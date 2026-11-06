import { describe, expect, it } from "vitest";
import { shopDayStartIso, timeZoneOffsetMinutes } from "./dates";

describe("timeZoneOffsetMinutes", () => {
  it("is +60 for Douala (UTC+1)", () => {
    expect(timeZoneOffsetMinutes(new Date("2026-11-06T12:00:00Z"), "Africa/Douala")).toBe(60);
  });

  it("is 0 for UTC", () => {
    expect(timeZoneOffsetMinutes(new Date("2026-11-06T12:00:00Z"), "UTC")).toBe(0);
  });
});

describe("shopDayStartIso", () => {
  it("returns the UTC instant of local midnight", () => {
    expect(shopDayStartIso("2026-11-06")).toBe("2026-11-05T23:00:00.000Z");
  });

  it("supports an exclusive end bound (next day)", () => {
    expect(shopDayStartIso("2026-12-31", 1)).toBe("2026-12-31T23:00:00.000Z");
  });

  it.each([[undefined], [""], ["06/11/2026"], ["2026-02-30"], ["2026-13-01"]])(
    "rejects %j",
    (value) => {
      expect(shopDayStartIso(value)).toBeUndefined();
    },
  );
});
