// Date helpers. The shop works in a single time zone; FCFA (XAF) countries
// are all on UTC+1 (no daylight saving). Make this a setting if needed.
export const SHOP_TIME_ZONE = "Africa/Douala";

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: SHOP_TIME_ZONE,
  dateStyle: "short",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Offset of a time zone from UTC at a given instant, in minutes. */
export function timeZoneOffsetMinutes(at: Date, timeZone = SHOP_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Start of a shop-local day ("2026-11-06") as a UTC ISO string, or undefined
 * for invalid input. `addDays` shifts the day (1 = start of the next day,
 * used as an exclusive upper bound).
 */
export function shopDayStartIso(
  day: string | undefined,
  addDays = 0,
  timeZone = SHOP_TIME_ZONE,
): string | undefined {
  if (!day || !DAY.test(day)) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d + addDays);
  if (Number.isNaN(utcMidnight)) return undefined;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return undefined;
  const offset = timeZoneOffsetMinutes(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offset * 60_000).toISOString();
}
