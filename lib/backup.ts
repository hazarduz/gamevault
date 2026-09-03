import type { Game } from "@prisma/client";

export const EXPORT_VERSION = 1;

const DECIMAL_FIELDS = [
  "purchasePriceGbp",
  "valueLooseGbp",
  "valueCibGbp",
  "valueNewGbp",
] as const;

const DATE_FIELDS = [
  "dateAdded",
  "datePurchased",
  "valueUpdatedAt",
  "releaseDate",
  "hltbUpdatedAt",
] as const;

// Every user-meaningful column on Game. Internal ids/timestamps are
// dropped — import re-creates rows fresh.
const GAME_FIELDS = [
  "title",
  "platform",
  "region",
  "condition",
  "format",
  "notes",
  "personalRating",
  "playStatus",
  "wishlist",
  "dateAdded",
  "datePurchased",
  "purchasePriceGbp",
  "valueLooseGbp",
  "valueCibGbp",
  "valueNewGbp",
  "valueUpdatedAt",
  "valueSource",
  "igdbId",
  "coverUrl",
  "releaseDate",
  "summary",
  "genres",
  "developer",
  "publisher",
  "aggregatedRating",
  "metacriticScore",
  "metacriticUrl",
  "hltbMainHours",
  "hltbMainExtraHours",
  "hltbCompletionistHours",
  "hltbUpdatedAt",
] as const;

const dateSet: ReadonlySet<string> = new Set(DATE_FIELDS);
const decimalSet: ReadonlySet<string> = new Set(DECIMAL_FIELDS);

export function serializeGame(g: Game): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of GAME_FIELDS) {
    const v = (g as Record<string, unknown>)[f];
    if (v === null || v === undefined) out[f] = null;
    else if (dateSet.has(f)) out[f] = (v as Date).toISOString();
    else if (decimalSet.has(f)) out[f] = Number(v);
    else out[f] = v;
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toDate = (v: unknown) => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Turn one record from a backup file into a safe prisma.game.createMany
// row for `userId`. Throws if it isn't a usable game.
export function gameCreateInput(raw: unknown, userId: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object") throw new Error("Not a game record");
  const r = raw as Record<string, unknown>;

  const title = String(r.title ?? "").trim();
  const platform = String(r.platform ?? "").trim();
  if (!title || !platform) throw new Error("A game is missing its title or platform");

  const data: Record<string, unknown> = {
    userId,
    title,
    platform,
    region: str(r.region),
    condition: str(r.condition),
    format: r.format === "Digital" ? "Digital" : "Physical",
    notes: str(r.notes),
    personalRating: int(r.personalRating),
    playStatus: typeof r.playStatus === "string" ? r.playStatus : "unplayed",
    wishlist: r.wishlist === true,
    datePurchased: toDate(r.datePurchased),
    valueUpdatedAt: toDate(r.valueUpdatedAt),
    valueSource: str(r.valueSource),
    igdbId: int(r.igdbId),
    coverUrl: str(r.coverUrl),
    releaseDate: toDate(r.releaseDate),
    summary: str(r.summary),
    genres: Array.isArray(r.genres)
      ? r.genres.filter((x): x is string => typeof x === "string")
      : [],
    developer: str(r.developer),
    publisher: str(r.publisher),
    aggregatedRating: num(r.aggregatedRating),
    metacriticScore: int(r.metacriticScore),
    metacriticUrl: str(r.metacriticUrl),
    hltbMainHours: num(r.hltbMainHours),
    hltbMainExtraHours: num(r.hltbMainExtraHours),
    hltbCompletionistHours: num(r.hltbCompletionistHours),
    hltbUpdatedAt: toDate(r.hltbUpdatedAt),
  };
  for (const f of DECIMAL_FIELDS) data[f] = num(r[f]);

  const added = toDate(r.dateAdded);
  if (added) data.dateAdded = added; // else fall through to @default(now())

  return data;
}

function validJson(s: string | null): string | null {
  if (!s) return null;
  try {
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}

export function sanitizeImportedPrefs(p: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!p || typeof p !== "object") return out;
  const r = p as Record<string, unknown>;

  for (const k of [
    "scoreBadgeEnabled",
    "statusBadgeEnabled",
    "dimCompleted",
    "dimPlayedPreviously",
    "psnEnabled",
  ]) {
    if (typeof r[k] === "boolean") out[k] = r[k];
  }
  if (typeof r.dimStrength === "number" && Number.isFinite(r.dimStrength)) {
    out.dimStrength = Math.min(95, Math.max(20, Math.round(r.dimStrength as number)));
  }
  if (r.scoreBadgeBands === null || typeof r.scoreBadgeBands === "string") {
    out.scoreBadgeBands = validJson(r.scoreBadgeBands as string | null);
  }
  if (r.statusColors === null || typeof r.statusColors === "string") {
    out.statusColors = validJson(r.statusColors as string | null);
  }
  if (r.psnOnlineId === null || typeof r.psnOnlineId === "string") {
    out.psnOnlineId = (r.psnOnlineId as string) || null;
  }
  if (typeof r.psnNpsso === "string" && r.psnNpsso) out.psnNpsso = r.psnNpsso;
  return out;
}
