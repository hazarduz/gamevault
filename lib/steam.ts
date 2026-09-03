// Reads a user's owned Steam library through the official Steam Web API
// (https://steamcommunity.com/dev/apikey — a single key for the whole
// instance, stored in Settings). Unlike PriceCharting / HLTB / PSN this
// one *is* a sanctioned public API, so there's no scraping and no
// per-user token — just the account's SteamID.
//
// This module only READS. Turning the returned titles into collection
// games happens client-side (IGDB matching + a review table) and then
// through app/api/games/import, exactly like the photo import.
//
// Two endpoints are used:
//   ISteamUser/ResolveVanityURL  — vanity name        -> SteamID64
//   IPlayerService/GetOwnedGames — SteamID64          -> owned games
//
// GetOwnedGames returns an empty object for `response` when the target
// profile's "Game details" privacy isn't Public — that's the single most
// common failure, so it gets its own error message.

const STEAM_API = "https://api.steampowered.com";

export interface SteamOwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  lastPlayed: number | null; // unix seconds, 0/undefined -> null
}

// Bounds the whole round-trip so a hung request fails fast with a
// readable error instead of the reverse proxy timing out. Mirrors the
// helper in lib/igdb.ts / lib/psn.ts.
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms)
    ),
  ]);
}

const STEAMID64_RE = /^\d{17}$/;

// Accepts whatever the user is most likely to paste: a bare SteamID64, a
// full profile URL (/profiles/<id> or /id/<vanity>), or a bare vanity
// name. Returns a resolved SteamID64.
export async function resolveSteamId(
  raw: string,
  apiKey: string
): Promise<string> {
  const input = raw.trim();
  if (!input) throw new Error("No Steam ID set — add yours in Settings.");

  // Full profile URL -> pull out the meaningful segment.
  let candidate = input;
  const urlMatch = input.match(
    /steamcommunity\.com\/(?:profiles|id)\/([^/?#]+)/i
  );
  if (urlMatch) candidate = decodeURIComponent(urlMatch[1]);

  if (STEAMID64_RE.test(candidate)) return candidate;

  // Anything else is treated as a vanity name.
  const url =
    `${STEAM_API}/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(apiKey)}` +
    `&vanityurl=${encodeURIComponent(candidate)}`;

  let data: any;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Steam rejected the API key — check it in site settings.");
    }
    if (!res.ok) throw new Error(`Steam ResolveVanityURL returned ${res.status}.`);
    data = await res.json();
  } catch (e: any) {
    if (e?.message?.startsWith("Steam ")) throw e;
    throw new Error(`Couldn't reach Steam to resolve "${candidate}" (${e?.message || e}).`);
  }

  // success = 1 means resolved; anything else means "no such vanity URL".
  if (data?.response?.success === 1 && data.response.steamid) {
    return String(data.response.steamid);
  }
  throw new Error(
    `Couldn't resolve "${candidate}" to a Steam account. Paste your SteamID64 (the 17-digit number) or your full profile URL instead.`
  );
}

async function fetchOwnedGames(
  steamId: string,
  apiKey: string
): Promise<SteamOwnedGame[]> {
  const url =
    `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}` +
    `&steamid=${encodeURIComponent(steamId)}` +
    `&include_appinfo=1&include_played_free_games=1&format=json`;

  let data: any;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Steam rejected the API key — check it in site settings.");
    }
    if (!res.ok) throw new Error(`Steam GetOwnedGames returned ${res.status}.`);
    data = await res.json();
  } catch (e: any) {
    if (e?.message?.startsWith("Steam ")) throw e;
    throw new Error(`Couldn't reach Steam (${e?.message || e}).`);
  }

  const response = data?.response;
  // A private "Game details" setting yields `response: {}` — no `games`
  // key and no `game_count`. A genuinely empty (but public) library has
  // `game_count: 0`.
  if (!response || (!("game_count" in response) && !Array.isArray(response.games))) {
    throw new Error(
      "Steam returned nothing. Set your profile's “Game details” privacy to Public (Steam → Edit Profile → Privacy Settings), then try again."
    );
  }

  const games: any[] = Array.isArray(response.games) ? response.games : [];
  return games
    .map((g) => ({
      appId: Number(g?.appid),
      name: String(g?.name ?? "").trim(),
      playtimeMinutes: Number(g?.playtime_forever ?? 0) || 0,
      lastPlayed: Number(g?.rtime_last_played ?? 0) || null,
    }))
    .filter((g) => Number.isInteger(g.appId) && g.appId > 0 && g.name)
    // Most-played first — the useful ones to confirm are near the top.
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);
}

export function getOwnedGames(
  steamId: string,
  apiKey: string
): Promise<SteamOwnedGame[]> {
  return withTimeout(fetchOwnedGames(steamId, apiKey), 30_000, "Steam library scan");
}
