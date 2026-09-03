// GamerPower aggregates "free to keep" game giveaways across Steam,
// Epic, GOG, itch.io and (sometimes) Xbox / PlayStation / Switch. It has
// a free, keyless JSON API — this is the main source for the Currently
// Free page.
//
//   GET https://www.gamerpower.com/api/giveaways?type=game
//
// Returns an array of giveaways, or an object like
// { status_code: 201, status_message: "No active giveaways..." } when
// there are none. If the shape changes, open the URL in a browser and
// re-map the fields below.

import type { FreeGame, FreeStore } from "@/lib/free-games";

const ENDPOINT = "https://www.gamerpower.com/api/giveaways?type=game";

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms)
    ),
  ]);
}

// GamerPower's `platforms` is a comma list like "PC, Steam" or
// "Epic Games Store" or "PC, Xbox One, Xbox Series X|S". Pick the store
// the user actually claims on, storefronts before consoles.
function storeFromPlatforms(platforms: string): FreeStore {
  const p = platforms.toLowerCase();
  if (p.includes("steam")) return "Steam";
  if (p.includes("epic")) return "Epic Games";
  if (p.includes("gog") || p.includes("drm-free")) return "GOG";
  if (p.includes("itch")) return "itch.io";
  if (p.includes("prime") || p.includes("amazon")) return "Amazon Prime";
  if (p.includes("xbox")) return "Xbox";
  if (p.includes("playstation") || /\bps[45]\b/.test(p)) return "PlayStation";
  if (p.includes("nintendo") || p.includes("switch")) return "Nintendo";
  return "Other";
}

function isMobileOnly(platforms: string): boolean {
  const parts = platforms
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    parts.length > 0 &&
    parts.every((p) => p.includes("android") || p.includes("ios"))
  );
}

// GamerPower dates look like "2026-09-10 23:59:00" (roughly US Pacific)
// or "N/A". Good enough to show a date; we don't do a live countdown.
function parseDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.toUpperCase() === "N/A") return null;
  const d = new Date(s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function typeOf(raw: unknown): FreeGame["type"] {
  const t = String(raw ?? "").toLowerCase();
  if (t.includes("dlc")) return "dlc";
  if (t.includes("loot")) return "loot";
  if (t.includes("game") || t.includes("early access")) return "game";
  return "other";
}

async function fetchOnce(): Promise<FreeGame[]> {
  const res = await fetch(ENDPOINT, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GamerPower returned ${res.status}.`);

  const data: any = await res.json();
  if (!Array.isArray(data)) return []; // "no active giveaways" object

  const out: FreeGame[] = [];
  for (const g of data) {
    const title = String(g?.title ?? "").trim();
    const url = String(g?.open_giveaway_url ?? g?.gamerpower_url ?? "").trim();
    if (!title || !url) continue;

    const platforms = String(g?.platforms ?? "");
    if (isMobileOnly(platforms)) continue;

    const worthRaw = String(g?.worth ?? "").trim();
    const store = storeFromPlatforms(platforms);

    out.push({
      id: `gamerpower:${g?.id ?? title}`,
      title,
      store,
      platformsLabel: platforms || store,
      url,
      imageUrl: String(g?.image || g?.thumbnail || "").trim() || null,
      description: String(g?.description ?? "").trim() || null,
      worth: worthRaw && worthRaw.toUpperCase() !== "N/A" && worthRaw !== "$0.00" ? worthRaw : null,
      startsAt: null,
      endsAt: parseDate(g?.end_date),
      type: typeOf(g?.type),
      status: "live",
      source: "gamerpower",
    });
  }
  return out;
}

export function fetchGamerPowerFree(): Promise<FreeGame[]> {
  return withTimeout(fetchOnce(), 15_000, "GamerPower giveaways");
}
