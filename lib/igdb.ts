// Thin client for the IGDB API. IGDB is served through Twitch's
// developer platform, so we first exchange the Client ID/Secret for an
// app access token, then query IGDB's own endpoints with it.
//
// Docs: https://api-docs.igdb.com/

import { getSettings, getTwitchCredentials } from "@/lib/settings";
import { PICKER_PLATFORMS } from "@/lib/picker-filters";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = await getTwitchCredentials();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Twitch/IGDB credentials. Add them in Settings, or in .env — see .env.example for setup instructions."
    );
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!res.ok) {
    throw new Error(`Failed to authenticate with Twitch: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    // Refresh a little early to be safe.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

async function igdbQuery(endpoint: string, body: string) {
  const settings = await getSettings();
  if (!settings.igdbEnabled) {
    throw new Error("IGDB lookups are turned off in Settings.");
  }

  const { clientId } = await getTwitchCredentials();
  const token = await getAccessToken();

  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB request failed (${res.status}): ${text}`);
  }

  return res.json();
}

export interface IgdbSearchResult {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  platforms: string[];
}

// Search by name. Returns a short list for the user to pick the right
// match from (same title often exists across many platforms/regions).
export async function searchIgdbGames(query: string): Promise<IgdbSearchResult[]> {
  const safeQuery = query.replace(/"/g, '\\"');
  const results = await igdbQuery(
    "games",
    `search "${safeQuery}";
     fields name, cover.image_id, first_release_date, platforms.name;
     limit 15;`
  );

  return results.map((g: any) => ({
    igdbId: g.id,
    title: g.name,
    coverUrl: g.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
      : null,
    releaseDate: g.first_release_date
      ? new Date(g.first_release_date * 1000).toISOString()
      : null,
    platforms: (g.platforms ?? []).map((p: any) => p.name),
  }));
}

export interface IgdbGameDetail {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  summary: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  aggregatedRating: number | null;
}

// Fetch full detail once the user has picked a specific match.
export async function getIgdbGameDetail(igdbId: number): Promise<IgdbGameDetail> {
  const results = await igdbQuery(
    "games",
    `fields name, cover.image_id, first_release_date, summary, genres.name,
      involved_companies.company.name, involved_companies.developer,
      involved_companies.publisher, aggregated_rating;
     where id = ${igdbId};`
  );

  const g = results[0];
  if (!g) throw new Error("Game not found on IGDB");

  const developer = (g.involved_companies ?? []).find((c: any) => c.developer)
    ?.company?.name ?? null;
  const publisher = (g.involved_companies ?? []).find((c: any) => c.publisher)
    ?.company?.name ?? null;

  return {
    igdbId: g.id,
    title: g.name,
    coverUrl: g.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
      : null,
    releaseDate: g.first_release_date
      ? new Date(g.first_release_date * 1000).toISOString()
      : null,
    summary: g.summary ?? null,
    genres: (g.genres ?? []).map((x: any) => x.name),
    developer,
    publisher,
    aggregatedRating: g.aggregated_rating ?? null,
  };
}

function coverUrl(imageId: string | undefined): string | null {
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
    : null;
}

// Full detail for many games in a single IGDB call — used by the bulk
// photo import. Same fields as getIgdbGameDetail.
export async function getIgdbGameDetailsBatch(
  ids: number[]
): Promise<Map<number, IgdbGameDetail>> {
  const map = new Map<number, IgdbGameDetail>();
  const unique = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (unique.length === 0) return map;

  const results: any[] = await igdbQuery(
    "games",
    `fields name, cover.image_id, first_release_date, summary, genres.name,
      involved_companies.company.name, involved_companies.developer,
      involved_companies.publisher, aggregated_rating;
     where id = (${unique.join(",")});
     limit ${Math.max(unique.length, 10)};`
  );

  for (const g of results) {
    const companies = g.involved_companies ?? [];
    map.set(g.id, {
      igdbId: g.id,
      title: g.name,
      coverUrl: coverUrl(g.cover?.image_id),
      releaseDate: g.first_release_date
        ? new Date(g.first_release_date * 1000).toISOString()
        : null,
      summary: g.summary ?? null,
      genres: (g.genres ?? []).map((x: any) => x.name),
      developer: companies.find((c: any) => c.developer)?.company?.name ?? null,
      publisher: companies.find((c: any) => c.publisher)?.company?.name ?? null,
      aggregatedRating: g.aggregated_rating ?? null,
    });
  }
  return map;
}

// Bounds a slow/hung IGDB call so a page renders an error notice instead
// of hanging until the reverse proxy times out.
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms)
    ),
  ]);
}

export interface PickerCandidate {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  summary: string | null;
  genres: string[];
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  rating: number | null; // critic score if there is one, else the combined rating
  platforms: string[];
  trailerYoutubeId: string | null;
  screenshots: string[]; // full image URLs
}

export interface PickerFilters {
  platformId?: number | null;
  genreId?: number | null;
}

export interface RandomGamesResult {
  games: PickerCandidate[];
  debug: { where: string; sort: string; total: number; offset: number; returned: number };
}

// A page of random-ish games for the Game Picker. Deliberately minimal
// filtering — just "has cover art" plus whatever platform/genre the user
// picked — so the pool stays enormous and the roll basically always
// finds something. IGDB has no random endpoint, so: count the matching
// pool, pick a valid random offset inside it (capped, IGDB pagination
// gets flaky past a few thousand), rotate the sort each call.
export async function getRandomGames(
  filters: PickerFilters = {}
): Promise<RandomGamesResult> {
  // Deliberately loose — no rating floor, no clock-dependent date
  // comparison (a wrong server clock was almost certainly why the old
  // roll came up empty). "Has a cover" + "has a release date" is enough
  // to weed out blank/duplicate entries.
  const clauses = ["cover != null", "first_release_date != null"];
  // Only ever roll games on the modern platforms the picker offers. A
  // specific platform filter narrows to just that one; with none set we
  // still restrict to the seven, never "anything IGDB has".
  const pickerPlatformIds = PICKER_PLATFORMS.map((p) => p.id).join(",");
  clauses.push(
    filters.platformId
      ? `platforms = (${Math.trunc(filters.platformId)})`
      : `platforms = (${pickerPlatformIds})`
  );
  if (filters.genreId) clauses.push(`genres = (${Math.trunc(filters.genreId)})`);
  const where = `where ${clauses.join(" & ")}`;

  const LIMIT = 50;
  const OFFSET_CAP = 4500;

  let total = 0;
  try {
    const c: any = await withTimeout(
      igdbQuery("games/count", `${where};`),
      10_000,
      "IGDB game picker count"
    );
    total = Number(c?.count) || 0;
  } catch {
    // Count is only used to size the offset — press on with a modest range.
  }

  const maxOffset =
    total > 0 ? Math.min(OFFSET_CAP, Math.max(0, total - LIMIT)) : 2000;
  const offset = Math.floor(Math.random() * (maxOffset + 1));

  const sortFields = [
    "total_rating",
    "rating",
    "aggregated_rating",
    "first_release_date",
    "hypes",
    "follows",
    "id",
  ];
  const sort = sortFields[Math.floor(Math.random() * sortFields.length)];
  const dir = Math.random() < 0.5 ? "asc" : "desc";

  const results: any[] = await withTimeout(
    igdbQuery(
      "games",
      `${where};
       fields name, cover.image_id, first_release_date, summary, genres.name,
         aggregated_rating, total_rating, rating, platforms.name,
         involved_companies.company.name, involved_companies.developer,
         involved_companies.publisher,
         videos.video_id, videos.name, screenshots.image_id;
       sort ${sort} ${dir};
       limit ${LIMIT};
       offset ${offset};`
    ),
    20_000,
    "IGDB game picker"
  );

  const games = results
    .filter((g) => g?.id && g?.name)
    .map((g) => {
      const companies = g.involved_companies ?? [];
      const rawRating = g.aggregated_rating ?? g.total_rating ?? g.rating ?? null;
      const videos: any[] = g.videos ?? [];
      const trailer =
        videos.find((v) => /trailer/i.test(String(v?.name ?? ""))) ?? videos[0];
      return {
        igdbId: g.id,
        title: g.name,
        coverUrl: coverUrl(g.cover?.image_id),
        summary: g.summary ?? null,
        genres: (g.genres ?? []).map((x: any) => x.name).filter(Boolean),
        releaseDate: g.first_release_date
          ? new Date(g.first_release_date * 1000).toISOString()
          : null,
        developer: companies.find((c: any) => c.developer)?.company?.name ?? null,
        publisher: companies.find((c: any) => c.publisher)?.company?.name ?? null,
        rating: typeof rawRating === "number" ? Math.round(rawRating) : null,
        platforms: (g.platforms ?? []).map((p: any) => p.name).filter(Boolean),
        trailerYoutubeId: trailer?.video_id ? String(trailer.video_id) : null,
        screenshots: (g.screenshots ?? [])
          .map((s: any) =>
            s?.image_id
              ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
              : null
          )
          .filter((u: string | null): u is string => !!u)
          .slice(0, 6),
      };
    });

  const debug = { where, sort: `${sort} ${dir}`, total, offset, returned: results.length };
  console.error("[picker]", JSON.stringify(debug), "-> usable:", games.length);
  return { games, debug };
}

export interface UpcomingRelease {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string; // ISO
  platforms: string[];
  hypes: number;
}

// Games with a first release date in the near future. Used by the
// Release Calendar.
export async function getUpcomingReleases(
  monthsAhead = 9
): Promise<UpcomingRelease[]> {
  const now = Math.floor(Date.now() / 1000);
  const until = now + monthsAhead * 30 * 24 * 60 * 60;

  const results: any[] = await withTimeout(
    igdbQuery(
      "games",
      `where first_release_date > ${now}
         & first_release_date < ${until}
         & cover != null;
       fields name, first_release_date, cover.image_id, platforms.name, hypes, category;
       sort first_release_date asc;
       limit 400;`
    ),
    25_000,
    "IGDB release calendar"
  );

  return results
    .filter((g) => {
      // category 0 = main game; keep those plus rows with no category set.
      const cat = g.category;
      const okType = cat === undefined || cat === null || cat === 0;
      const ts = Number(g.first_release_date);
      return okType && Number.isFinite(ts) && ts > 0;
    })
    .map((g) => ({
      igdbId: g.id,
      title: g.name,
      coverUrl: coverUrl(g.cover?.image_id),
      releaseDate: new Date(Number(g.first_release_date) * 1000).toISOString(),
      platforms: (g.platforms ?? []).map((p: any) => p.name).filter(Boolean),
      hypes: typeof g.hypes === "number" ? g.hypes : 0,
    }));
}

export interface SimilarSuggestion {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseYear: number | null;
  rating: number | null;
  summary: string | null;
  platforms: string[];
  count: number; // how many owned games list this as "similar"
}

// Publishers whose games are excluded from Indie Discover. Matched
// case-insensitively as substrings of the publisher company name.
const AAA_PUBLISHERS = [
  "electronic arts",
  "ea games",
  "ea sports",
  "ubisoft",
  "activision",
  "blizzard",
  "sony interactive",
  "sony computer",
  "playstation",
  "microsoft",
  "xbox game studios",
  "bethesda",
  "zenimax",
  "take-two",
  "take two",
  "rockstar",
  "2k ",
  "nintendo",
  "square enix",
  "capcom",
  "bandai namco",
  "namco",
  "sega",
  "konami",
  "warner bros",
  "wb games",
];

const INDIE_GENRE_ID = 32; // IGDB "Indie"

// Aggregate IGDB's similar_games across every owned game, drop anything
// already owned/wishlisted, rank by recurrence. Powers Discover and
// (with indieOnly) Indie Discover.
export async function getSimilarGamesForCollection(
  ownedIgdbIds: number[],
  excludeIgdbIds: Set<number>,
  opts: { indieOnly?: boolean } = {}
): Promise<SimilarSuggestion[]> {
  if (ownedIgdbIds.length === 0) return [];

  const owned: any[] = await withTimeout(
    igdbQuery(
      "games",
      `where id = (${ownedIgdbIds.join(",")});
       fields similar_games;
       limit 500;`
    ),
    25_000,
    "IGDB discover"
  );

  const tally = new Map<number, number>();
  for (const g of owned) {
    for (const sid of (g.similar_games ?? []) as number[]) {
      if (excludeIgdbIds.has(sid)) continue;
      tally.set(sid, (tally.get(sid) ?? 0) + 1);
    }
  }
  if (tally.size === 0) return [];

  // A generous pool so the Discover pages can rotate through fresh
  // batches without re-hitting IGDB. Indie casts wider still since the
  // genre + publisher filter thins it out.
  const topIds = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.indieOnly ? 200 : 120)
    .map(([id]) => id);

  const extraFields = opts.indieOnly
    ? ", genres, involved_companies.company.name, involved_companies.publisher"
    : "";

  const details: any[] = await withTimeout(
    igdbQuery(
      "games",
      `where id = (${topIds.join(",")});
       fields name, cover.image_id, first_release_date, rating, summary, platforms.name${extraFields};
       limit 250;`
    ),
    25_000,
    "IGDB discover detail"
  );

  const filtered = opts.indieOnly
    ? details.filter((g) => {
        const isIndie = ((g.genres ?? []) as number[]).includes(INDIE_GENRE_ID);
        if (!isIndie) return false;
        const publishers = ((g.involved_companies ?? []) as any[])
          .filter((c) => c.publisher)
          .map((c) => String(c.company?.name ?? "").toLowerCase());
        return !publishers.some((name) =>
          AAA_PUBLISHERS.some((bad) => name.includes(bad))
        );
      })
    : details;

  return filtered
    .map((g) => ({
      igdbId: g.id,
      title: g.name,
      coverUrl: coverUrl(g.cover?.image_id),
      releaseYear: g.first_release_date
        ? new Date(g.first_release_date * 1000).getUTCFullYear()
        : null,
      rating: typeof g.rating === "number" ? Math.round(g.rating) : null,
      summary: g.summary ?? null,
      platforms: (g.platforms ?? []).map((p: any) => p.name),
      count: tally.get(g.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, opts.indieOnly ? 120 : 150);
}
