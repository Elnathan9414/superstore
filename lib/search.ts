// Helpers for building safe PostgREST filters from user input.

/**
 * Cleans a free-text search so it can be embedded in a PostgREST `or=(...)`
 * filter: removes characters with special meaning there (, ( ) " \ * % :)
 * and collapses whitespace. Returns null when nothing is left.
 */
export function cleanSearch(input: string | null | undefined, maxLength = 100): string | null {
  if (!input) return null;
  const cleaned = input
    .replace(/[,()"\\*%:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

/** `or` filter matching any of the columns (case-insensitive contains). */
export function ilikeAny(columns: readonly string[], term: string): string {
  return columns.map((c) => `${c}.ilike.*${term}*`).join(",");
}

/** Positive integer page number from a search param (defaults to 1). */
export function pageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** First value of a search param. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
