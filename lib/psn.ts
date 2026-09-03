// Reads PlayStation trophy progress via the `psn-api` package (Sony's
// real endpoints — no scraping) and works out which titles have an
// earned platinum. Auth is a per-account NPSSO token pasted into
// Settings; it lasts ~2 months, then Sony rejects it and the user grabs
// a fresh one.
//
// This module only READS. Writing "platinum" to games happens in
// app/api/psn/apply after the user confirms the title -> game mapping.
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  makeUniversalSearch,
  getUserTitles,
} from "psn-api";
import { getSettings } from "@/lib/settings";

export interface PsnPlatinumTitle {
  name: string;
  platform: string;
}

export interface MatchCandidate {
  id: string;
  title: string;
  platform: string;
}

async function authorize(): Promise<{ accessToken: string; onlineId: string }> {
  const settings = await getSettings();
  if (!settings.psnEnabled) {
    throw new Error("PlayStation sync is turned off in Settings.");
  }
  if (!settings.psnNpsso) {
    throw new Error("No PlayStation token set — add your NPSSO token in Settings.");
  }

  let accessCode: string;
  try {
    accessCode = await exchangeNpssoForAccessCode(settings.psnNpsso);
  } catch {
    throw new Error(
      "PlayStation token was rejected — it has most likely expired. Grab a fresh NPSSO value (see the steps in Settings)."
    );
  }

  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  return { accessToken: tokens.accessToken, onlineId: settings.psnOnlineId ?? "" };
}

async function resolveAccountId(
  accessToken: string,
  onlineId: string
): Promise<string> {
  if (!onlineId.trim()) return "me";

  const search: any = await makeUniversalSearch(
    { accessToken },
    onlineId.trim(),
    "SocialAllAccounts"
  );
  const accountId =
    search?.domainResponses?.[0]?.results?.[0]?.socialMetadata?.accountId;
  if (!accountId) {
    throw new Error(
      `Couldn't find PSN profile "${onlineId}" — check the spelling, and that its trophy list is set to public.`
    );
  }
  return String(accountId);
}

export async function getEarnedPlatinumTitles(): Promise<PsnPlatinumTitle[]> {
  const { accessToken, onlineId } = await authorize();
  const accountId = await resolveAccountId(accessToken, onlineId);

  const platinums: PsnPlatinumTitle[] = [];
  const limit = 800;
  let offset = 0;

  // Guarded loop — Sony caps the list well under 50 * 800.
  for (let guard = 0; guard < 50; guard++) {
    const page: any = await getUserTitles({ accessToken }, accountId, {
      limit,
      offset,
    });
    const titles: any[] = page?.trophyTitles ?? [];

    for (const t of titles) {
      const defined = Number(t?.definedTrophies?.platinum ?? 0);
      const earned = Number(t?.earnedTrophies?.platinum ?? 0);
      if (defined > 0 && earned > 0) {
        platinums.push({
          name: String(t?.trophyTitleName ?? "").trim(),
          platform: String(t?.trophyTitlePlatform ?? "").trim(),
        });
      }
    }

    const total = Number(page?.totalItemCount ?? 0);
    offset += limit;
    if (titles.length === 0 || offset >= total) break;
  }

  return platinums.filter((p) => p.name);
}

const EDITION_RE =
  /\b(?:digital\s+)?(?:standard|deluxe|collector'?s?|complete|definitive|ultimate|special|limited|launch|gold|premium|remastered|remaster|anniversary|game of the year|goty|bundle)\b(?:\s+edition)?/gi;

const PLATFORM_TAG_RE =
  /\b(?:ps5|ps4|ps3|ps ?vita|vita|psp|playstation\s*[1-5]?|for playstation)\b/gi;

// Loose title key for matching a PSN title to a collection game. Both
// sides go through this; exact-equal is a confident match, substring is
// a "probably" the user still confirms.
export function normalizeTitleForMatch(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD") // decompose accents; the a-z0-9 filter below drops the marks
    .replace(/\band\b/g, "&")
    .replace(EDITION_RE, " ")
    .replace(PLATFORM_TAG_RE, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function looksLikePlayStation(platform: string): boolean {
  return /playstation|ps ?[1-5]|vita|psp/i.test(platform);
}

export function suggestGameId(
  psnName: string,
  _psnPlatform: string,
  games: MatchCandidate[]
): string | null {
  const target = normalizeTitleForMatch(psnName);
  if (!target) return null;

  const exact = games.filter((g) => normalizeTitleForMatch(g.title) === target);
  const pool =
    exact.length > 0
      ? exact
      : games.filter((g) => {
          const n = normalizeTitleForMatch(g.title);
          return n.length > 3 && (n.includes(target) || target.includes(n));
        });

  if (pool.length === 0) return null;

  return (pool.find((g) => looksLikePlayStation(g.platform)) ?? pool[0]).id;
}
