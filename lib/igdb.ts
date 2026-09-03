// Thin client for the IGDB API. IGDB is served through Twitch's
// developer platform, so we first exchange the Client ID/Secret for an
// app access token, then query IGDB's own endpoints with it.
//
// Docs: https://api-docs.igdb.com/

import { getSettings, getTwitchCredentials } from "@/lib/settings";

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

  // For the indie view, cast a wider net before filtering.
  const topIds = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.indieOnly ? 120 : 40)
    .map(([id]) => id);

  const extraFields = opts.indieOnly
    ? ", genres, involved_companies.company.name, involved_companies.publisher"
    : "";

  const details: any[] = await withTimeout(
    igdbQuery(
      "games",
      `where id = (${topIds.join(",")});
       fields name, cover.image_id, first_release_date, rating, summary, platforms.name${extraFields};
       limit 120;`
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
    .slice(0, 40);
}
