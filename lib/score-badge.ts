// Score circles shown on cover art on the home page. The number is
// IGDB's aggregated critic score (Game.aggregatedRating, 0-100); the
// circle and text colours come from a set of bands the user can edit in
// Settings. These helpers are pure (no server-only imports) so both
// server components and the settings API can use them.

export interface ScoreBand {
  min: number; // inclusive, 0-100
  max: number; // inclusive, 0-100
  bg: string; // circle colour, #rgb or #rrggbb
  fg: string; // text colour, #rgb or #rrggbb
}

// User-specified defaults. The top band is 75-100, so 51-74 is exclusive
// of 75 — this resolves the 51-75 / 75-100 overlap in the original spec.
export const DEFAULT_SCORE_BANDS: ScoreBand[] = [
  { min: 0, max: 10, bg: "#000000", fg: "#ffffff" },
  { min: 11, max: 30, bg: "#9ca3af", fg: "#ffffff" },
  { min: 31, max: 50, bg: "#f7c8d9", fg: "#1a1a1a" },
  { min: 51, max: 74, bg: "#f5c98a", fg: "#1a1a1a" },
  { min: 75, max: 100, bg: "#a8d5a2", fg: "#1a1a1a" },
];

const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// Validates arbitrary input (parsed JSON, or a request body) into a
// clean band list. Rows with non-numeric bounds or non-hex colours are
// dropped rather than coerced to something misleading. The hex check
// also keeps the values safe to drop straight into a style attribute.
export function sanitizeScoreBands(input: unknown): ScoreBand[] {
  if (!Array.isArray(input)) return [];

  const bands: ScoreBand[] = [];
  for (const row of input) {
    const r = row as Record<string, unknown>;
    const min = Math.round(Number(r?.min));
    const max = Math.round(Number(r?.max));
    const bg = typeof r?.bg === "string" ? r.bg : "";
    const fg = typeof r?.fg === "string" ? r.fg : "";

    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    if (!HEX_COLOUR.test(bg) || !HEX_COLOUR.test(fg)) continue;

    const lo = clamp(Math.min(min, max), 0, 100);
    const hi = clamp(Math.max(min, max), 0, 100);
    bands.push({ min: lo, max: hi, bg, fg });
  }
  return bands;
}

// Reads the stored JSON string. Falls back to the built-in defaults for
// null, malformed JSON, or a list that sanitises down to nothing.
export function parseScoreBands(raw: string | null | undefined): ScoreBand[] {
  if (!raw) return DEFAULT_SCORE_BANDS;
  try {
    const clean = sanitizeScoreBands(JSON.parse(raw));
    return clean.length > 0 ? clean : DEFAULT_SCORE_BANDS;
  } catch {
    return DEFAULT_SCORE_BANDS;
  }
}

export function pickScoreBand(
  score: number | null | undefined,
  bands: ScoreBand[]
): ScoreBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  const s = Math.round(score);
  return bands.find((b) => s >= b.min && s <= b.max) ?? null;
}
