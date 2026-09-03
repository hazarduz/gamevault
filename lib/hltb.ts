// HowLongToBeat has no official public API. Their own site (a Next.js
// app) reaches the data through two endpoints, and this mirrors that
// flow exactly:
//
//   1. GET  /api/search/site/init?t=<ms>  -> { token, hpKey, hpVal }
//   2. POST /api/search/site              with headers
//        x-auth-token: <token>
//        x-hp-key:     <hpKey>
//        x-hp-val:     <hpVal>
//      and a search payload that also carries { [hpKey]: hpVal } inline.
//
// The token embeds the caller's IP and User-Agent, so both requests must
// go out from the same host (they do — this runs server-side) with the
// same User-Agent header, which is why UA is pinned below.
//
// This previously used the "howlongtobeat" npm package. That package
// went unmaintained in 2022 and stopped working when HLTB introduced the
// token step above — importing it was also crashing the enrich route at
// load time. If HLTB changes this flow again, open their site with the
// network tab recording, run a search, and copy the new endpoint /
// headers / payload shape here.
import { getSettings } from "@/lib/settings";

const HLTB_BASE = "https://howlongtobeat.com";

// Must stay a plausible desktop-browser UA and must be sent identically
// on both requests (see note above about the token binding).
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface HltbResult {
  title: string;
  mainHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
}

// HLTB returns play times as seconds. Anything <= 0 means "no data".
function secondsToHours(value: unknown): number | null {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round((seconds / 3600) * 10) / 10;
}

async function getSearchCredentials(): Promise<{
  token: string;
  hpKey: string;
  hpVal: string;
}> {
  const res = await fetch(`${HLTB_BASE}/api/search/site/init?t=${Date.now()}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: `${HLTB_BASE}/`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`init endpoint returned ${res.status}`);

  const data = await res.json();
  if (!data?.token || !data?.hpKey) {
    throw new Error("init endpoint response was missing the token fields");
  }
  return { token: data.token, hpKey: data.hpKey, hpVal: data.hpVal };
}

export async function searchHltb(query: string): Promise<HltbResult[]> {
  const settings = await getSettings();
  if (!settings.hltbEnabled) {
    throw new Error("HowLongToBeat lookups are turned off in Settings.");
  }

  let payload: any;
  try {
    const { token, hpKey, hpVal } = await getSearchCredentials();

    const body: Record<string, unknown> = {
      searchType: "games",
      searchTerms: query.trim().split(/\s+/).filter(Boolean),
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: "",
          sortCategory: "popular",
          rangeCategory: "main",
          rangeTime: { min: null, max: null },
          gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
          rangeYear: { min: "", max: "" },
          modifier: "",
        },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "",
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
      // HLTB echoes this honeypot pair in the body as well as the headers.
      [hpKey]: hpVal,
    };

    const res = await fetch(`${HLTB_BASE}/api/search/site`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Referer: `${HLTB_BASE}/`,
        Origin: HLTB_BASE,
        Accept: "application/json",
        "x-auth-token": token,
        "x-hp-key": hpKey,
        "x-hp-val": hpVal,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`search endpoint returned ${res.status}`);
    payload = await res.json();
  } catch (e: any) {
    throw new Error(
      `HowLongToBeat lookup failed (${e.message}). Their site changes shape from time to time and breaks this — enter times manually if it keeps happening.`
    );
  }

  const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];

  return rows
    .filter((g) => g && typeof g.game_name === "string")
    .map((g) => ({
      title: g.game_name,
      mainHours: secondsToHours(g.comp_main),
      mainExtraHours: secondsToHours(g.comp_plus),
      completionistHours: secondsToHours(g.comp_100),
    }));
}
