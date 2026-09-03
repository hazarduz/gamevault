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
