// Barcode -> product-name lookup for the Add a game screen. IGDB has no
// barcode data, so a scanned UPC/EAN is resolved to a product title
// through a third-party UPC database, then that title is cleaned up and
// handed to the existing IGDB search. Best-effort: the user still picks
// the IGDB match.
//
// Default provider is UPCitemdb's trial endpoint — no API key, ~100
// lookups/day. Response shape:
//   { "code": "OK", "total": 1, "items": [ { "title": "...", "brand": "..." } ] }
// Errors come back as { "code": "INVALID_UPC", ... } or total: 0.
import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { getSettings } from "@/lib/settings";

export const DEFAULT_BARCODE_API =
  "https://api.upcitemdb.com/prod/trial/lookup?upc=";

// Platform names/abbreviations to strip out of a product title.
const PLATFORM_NOISE: string[] = [
  ...PLATFORM_OPTIONS,
  "PS5", "PS4", "PS3", "PS2", "PS1", "PSX", "PS Vita", "PSVita",
  "Xbox Series X", "Xbox Series S", "Series X|S", "XBox360", "XboxOne",
  "Switch 2", "Switch", "3DS", "GBA", "GBC", "N64", "GCN", "Wii U", "Wii",
  "SNES", "NES",
];

const EDITION_RE =
  /\b(?:standard|deluxe|collector'?s?|complete|definitive|ultimate|special|limited|launch|gold|premium|remastered|anniversary|game of the year|goty)\s+edition\b/gi;

// Only unambiguous region markers — deliberately no bare "us"/"uk"/"eu"
// (they appear in real titles, e.g. "The Last of Us").
const REGION_RE = /\b(?:pal|ntsc(?:-[juc])?|region[\s-]?free|import)\b/gi;

const VIDEO_GAME_RE = /\b(?:[a-z]+\s+)?video game\b/gi;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Turns e.g. "Mario Kart 8 Deluxe racing video game (Nintendo Switch)"
// into "Mario Kart 8 Deluxe". Conservative — leaves hyphenated names like
// "Spider-Man" alone; IGDB search is fuzzy and the user confirms.
export function cleanGameTitle(raw: string): string {
  const original = String(raw ?? "").trim();
  let t = original;

  t = t.replace(/\([^)]*\)/g, " "); // (Nintendo Switch)
  t = t.replace(/\[[^\]]*\]/g, " "); // [PAL]
  t = t.replace(VIDEO_GAME_RE, " ");
  t = t.replace(EDITION_RE, " ");

  for (const name of [...PLATFORM_NOISE].sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(`\\b(?:for|on)?\\s*${escapeRe(name)}\\b`, "gi"), " ");
  }

  t = t.replace(REGION_RE, " ");
  t = t.replace(/\s+[-–—:/|]+\s+/g, " "); // " - " style separators only
  t = t.replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, "").trim();

  return t || original;
}

export interface BarcodeLookupResult {
  code: string;
  productName: string;
  brand: string | null;
  cleanedTitle: string;
}

export async function lookupBarcode(
  code: string
): Promise<BarcodeLookupResult | null> {
  const settings = await getSettings();
  if (!settings.barcodeLookupEnabled) {
    throw new Error("Barcode lookups are turned off in Settings.");
  }

  const base = settings.barcodeApiUrl || DEFAULT_BARCODE_API;
  const url = base.includes("{code}")
    ? base.replace("{code}", encodeURIComponent(code))
    : base + encodeURIComponent(code);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "GameVault personal collection tool",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Barcode provider returned ${res.status}`);

  const data: any = await res.json();

  // UPCitemdb first, then a couple of shapes other providers use.
  const productName: unknown =
    data?.items?.[0]?.title ??
    data?.title ??
    data?.product?.title ??
    data?.data?.title;
  if (typeof productName !== "string" || !productName.trim()) return null;

  const brandRaw: unknown =
    data?.items?.[0]?.brand ?? data?.brand ?? data?.product?.brand ?? null;

  return {
    code,
    productName: productName.trim(),
    brand: typeof brandRaw === "string" && brandRaw.trim() ? brandRaw.trim() : null,
    cleanedTitle: cleanGameTitle(productName),
  };
}
