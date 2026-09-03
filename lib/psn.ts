// Reads PlayStation trophy progress via the `psn-api` package (Sony's
// real endpoints — no scraping) and works out which titles have an
// earned platinum. Auth is a per-account NPSSO token pasted into
// Settings; it lasts ~2 months, then Sony rejects it and the user grabs
// a fresh one.
//
// This module only READS. Writing "platinum" to games happens in
// app/api/psn/apply after the user confirms the title -> game mapping.
//
// psn-api is loaded with a dynamic import inside the functions rather
// than a top-level import: that keeps it out of the Next build graph, so
// a bundling problem or a wrong export name shows up as a catchable
// runtime error (a 502 with a real message) instead of failing the
// whole production build.

async function loadPsnApi() {
  const mod: any = await import("psn-api");
  for (const fn of [
    "exchangeNpssoForAccessCode",
    "exchangeAccessCodeForAuthTokens",
    "getUserTitles",
  ]) {
    if (typeof mod[fn] !== "function") {
      throw new Error(`psn-api is missing ${fn}() — the package version may have changed.`);
    }
  }
  return mod as {
    exchangeNpssoForAccessCode: (npsso: string) => Promise<string>;
    exchangeAccessCodeForAuthTokens: (code: string) => Promise<{ accessToken: string }>;
    getUserTitles: (
      auth: { accessToken: string },
      accountId: string,
      options?: { limit?: number; offset?: number }
    ) => Promise<any>;
    getProfileFromUserName?: (
      auth: { accessToken: string },
      userName: string
    ) => Promise<any>;
    makeUniversalSearch?: (
      auth: { accessToken: string },
      term: string,
      domain: string
    ) => Promise<any>;
  };
}

export interface PsnPlatinumTitle {
  name: string;
  platform: string;
}

export interface MatchCandidate {
  id: string;
  title: string;
  platform: string;
}

export interface PsnCredentials {
  psnEnabled: boolean;
  psnOnlineId: string | null;
  psnNpsso: string | null;
}

async function authorize(
  creds: PsnCredentials
): Promise<{ accessToken: string; onlineId: string }> {
  if (!creds.psnEnabled) {
    throw new Error("PlayStation sync is turned off in Settings.");
  }
  if (!creds.psnNpsso) {
    throw new Error("No PlayStation token set — add your NPSSO token in Settings.");
  }

  const { exchangeNpssoForAccessCode, exchangeAccessCodeForAuthTokens } = await loadPsnApi();

  let accessCode: string;
  try {
    accessCode = await exchangeNpssoForAccessCode(creds.psnNpsso);
  } catch {
    throw new Error(
      "PlayStation token was rejected — it has most likely expired. Grab a fresh NPSSO value (see the steps in Settings)."
    );
  }

  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  return { accessToken: tokens.accessToken, onlineId: creds.psnOnlineId ?? "" };
}

async function resolveAccountId(
  accessToken: string,
  onlineId: string
): Promise<string> {
  const name = onlineId.trim();
  if (!name) return "me";

  const api = await loadPsnApi();
  const auth = { accessToken };

  // Canonical username -> accountId.
  if (api.getProfileFromUserName) {
    try {
      const r: any = await api.getProfileFromUserName(auth, name);
      const id = r?.profile?.accountId ?? r?.accountId;
      if (id) return String(id);
    } catch {
      /* fall through */
    }
  }

  // Fuzzy search fallback.
  if (api.makeUniversalSearch) {
    try {
      const s: any = await api.makeUniversalSearch(auth, name, "SocialAllAccounts");
      const first = s?.domainResponses?.[0]?.results?.[0];
      const id = first?.socialMetadata?.accountId ?? first?.accountId;
      if (id) return String(id);
    } catch {
      /* fall through */
    }
  }

  // Couldn't resolve the name — assume it's the token owner's own
  // account (the common case). If it was actually a friend's ID, the
  // wrong platinums show up in the review table and simply aren't
  // applied.
  return "me";
}

// Caps the whole PSN round-trip so a hung request from psn-api / Sony
// fails fast with a readable error instead of the reverse proxy timing
// out and Cloudflare showing a bare "Bad gateway".
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms)
    ),
  ]);
}

export function getEarnedPlatinumTitles(
  creds: PsnCredentials
): Promise<PsnPlatinumTitle[]> {
  return withTimeout(scanPlatinums(creds), 45_000, "PlayStation trophy scan");
}

async function scanPlatinums(creds: PsnCredentials): Promise<PsnPlatinumTitle[]> {
  const { accessToken, onlineId } = await authorize(creds);
  const accountId = await resolveAccountId(accessToken, onlineId);
  const { getUserTitles } = await loadPsnApi();

  const platinums: PsnPlatinumTitle[] = [];
  const limit = 200;
  let offset = 0;

  // Guarded loop — Sony caps the list well under 25 * 200.
  for (let guard = 0; guard < 25; guard++) {
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
    if (titles.length < limit || offset >= total) break;
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
