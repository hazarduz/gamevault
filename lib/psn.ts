// Reads PlayStation trophy data via the `psn-api` package (Sony's real
// endpoints — no scraping). Auth is a per-account NPSSO token pasted into
// Settings; it lasts ~2 months, then Sony rejects it and the user grabs a
// fresh one.
//
// This module only READS. Linking a game to a PSN title and writing its
// trophies happens in lib/psn.ts's applyTrophySync(), called from
// app/api/psn/apply, app/api/psn/sync-all and
// app/api/games/[id]/sync-trophies after the caller has decided which
// game a PSN title belongs to.
//
// psn-api is loaded with a dynamic import inside the functions rather
// than a top-level import: that keeps it out of the Next build graph, so
// a bundling problem or a wrong export name shows up as a catchable
// runtime error (a 502 with a real message) instead of failing the
// whole production build.

import { prisma } from "@/lib/prisma";

async function loadPsnApi() {
  const mod: any = await import("psn-api");
  for (const fn of [
    "exchangeNpssoForAccessCode",
    "exchangeAccessCodeForAuthTokens",
    "getUserTitles",
    "getTitleTrophies",
    "getUserTrophiesEarnedForTitle",
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
    getTitleTrophies: (
      auth: { accessToken: string },
      npCommunicationId: string,
      trophyGroupId: string,
      options?: { npServiceName?: string }
    ) => Promise<any>;
    getUserTrophiesEarnedForTitle: (
      auth: { accessToken: string },
      accountId: string,
      npCommunicationId: string,
      trophyGroupId: string,
      options?: { npServiceName?: string }
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

export interface PsnCredentials {
  psnEnabled: boolean;
  psnOnlineId: string | null;
  psnNpsso: string | null;
}

export interface MatchCandidate {
  id: string;
  title: string;
  platform: string;
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
  // wrong titles show up in the review table and simply aren't applied.
  return "me";
}

// Caps a single PSN round-trip so a hung request from psn-api / Sony
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

// --- Discovery: list the account's owned PSN titles ------------------

export interface TrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface PsnTitleSummary {
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
  name: string;
  platform: string; // raw trophyTitlePlatform, e.g. "PS5" or "PS4,PS5"
  iconUrl: string | null;
  defined: TrophyCounts;
  earned: TrophyCounts;
}

// PSN's own split: PS5 titles need npServiceName "trophy2"; PS4/PS3/Vita
// titles need "trophy". getUserTitles() actually returns this per title
// (preferred — see below); this is only a fallback for when it doesn't.
// If it's still wrong for a given title, syncTitleTrophies() retries with
// the other value rather than failing outright.
function deriveNpServiceName(platformLabel: string): "trophy" | "trophy2" {
  return /ps5/i.test(platformLabel) ? "trophy2" : "trophy";
}

function readNpServiceName(t: any, platformLabel: string): "trophy" | "trophy2" {
  return t?.npServiceName === "trophy" || t?.npServiceName === "trophy2"
    ? t.npServiceName
    : deriveNpServiceName(platformLabel);
}

export function getOwnedPsnTitles(
  creds: PsnCredentials
): Promise<PsnTitleSummary[]> {
  return withTimeout(listOwnedTitles(creds), 45_000, "PlayStation library scan");
}

async function listOwnedTitles(creds: PsnCredentials): Promise<PsnTitleSummary[]> {
  const { accessToken, onlineId } = await authorize(creds);
  const accountId = await resolveAccountId(accessToken, onlineId);
  const { getUserTitles } = await loadPsnApi();

  const titles: PsnTitleSummary[] = [];
  const limit = 200;
  let offset = 0;

  // Guarded loop — Sony caps the list well under 25 * 200.
  for (let guard = 0; guard < 25; guard++) {
    const page: any = await getUserTitles({ accessToken }, accountId, {
      limit,
      offset,
    });
    const pageTitles: any[] = page?.trophyTitles ?? [];

    for (const t of pageTitles) {
      const name = String(t?.trophyTitleName ?? "").trim();
      const npCommunicationId = String(t?.npCommunicationId ?? "").trim();
      if (!name || !npCommunicationId) continue;

      const platform = String(t?.trophyTitlePlatform ?? "").trim();
      titles.push({
        npCommunicationId,
        npServiceName: readNpServiceName(t, platform),
        name,
        platform,
        iconUrl: t?.trophyTitleIconUrl ?? null,
        defined: {
          bronze: Number(t?.definedTrophies?.bronze ?? 0),
          silver: Number(t?.definedTrophies?.silver ?? 0),
          gold: Number(t?.definedTrophies?.gold ?? 0),
          platinum: Number(t?.definedTrophies?.platinum ?? 0),
        },
        earned: {
          bronze: Number(t?.earnedTrophies?.bronze ?? 0),
          silver: Number(t?.earnedTrophies?.silver ?? 0),
          gold: Number(t?.earnedTrophies?.gold ?? 0),
          platinum: Number(t?.earnedTrophies?.platinum ?? 0),
        },
      });
    }

    const total = Number(page?.totalItemCount ?? 0);
    offset += limit;
    if (pageTitles.length < limit || offset >= total) break;
  }

  return titles;
}

// --- Matching a PSN title to a collection game ------------------------

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

// --- Syncing one title's full trophy list -----------------------------

export interface TrophyRow {
  psnTrophyId: number;
  groupId: string;
  sortOrder: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  type: "bronze" | "silver" | "gold" | "platinum";
  hidden: boolean;
  rarityPct: number | null;
  earned: boolean;
  earnedAt: string | null; // ISO
}

function normalizeType(raw: unknown): TrophyRow["type"] {
  const t = String(raw ?? "").toLowerCase();
  return t === "bronze" || t === "silver" || t === "gold" || t === "platinum"
    ? t
    : "bronze";
}

// Fetches every trophy for a title (all groups — base game plus any DLC)
// and merges in this account's earned status/date. Tries the given
// npServiceName first; if that comes back empty, retries once with the
// other value — Sony's PS5-vs-legacy split isn't always predictable from
// the platform label alone.
export async function syncTitleTrophies(
  creds: PsnCredentials,
  npCommunicationId: string,
  npServiceNameHint: "trophy" | "trophy2"
): Promise<TrophyRow[]> {
  return withTimeout(
    fetchTrophies(creds, npCommunicationId, npServiceNameHint),
    45_000,
    "PlayStation trophy sync"
  );
}

async function fetchTrophies(
  creds: PsnCredentials,
  npCommunicationId: string,
  npServiceNameHint: "trophy" | "trophy2"
): Promise<TrophyRow[]> {
  const { accessToken, onlineId } = await authorize(creds);
  const accountId = await resolveAccountId(accessToken, onlineId);
  const { getTitleTrophies, getUserTrophiesEarnedForTitle } = await loadPsnApi();
  const auth = { accessToken };

  async function tryService(npServiceName: "trophy" | "trophy2"): Promise<TrophyRow[]> {
    const [defs, earned]: [any, any] = await Promise.all([
      getTitleTrophies(auth, npCommunicationId, "all", { npServiceName }),
      getUserTrophiesEarnedForTitle(auth, accountId, npCommunicationId, "all", { npServiceName }),
    ]);

    const earnedById = new Map<number, any>();
    for (const e of (earned?.trophies ?? []) as any[]) {
      const id = Number(e?.trophyId);
      if (Number.isInteger(id)) earnedById.set(id, e);
    }

    return ((defs?.trophies ?? []) as any[])
      .map((d, i): TrophyRow | null => {
        const psnTrophyId = Number(d?.trophyId);
        if (!Number.isInteger(psnTrophyId)) return null;
        const e = earnedById.get(psnTrophyId);
        return {
          psnTrophyId,
          groupId: String(d?.trophyGroupId ?? "default"),
          sortOrder: i,
          name: String(d?.trophyName ?? "Unknown trophy"),
          description: d?.trophyDetail ?? null,
          iconUrl: d?.trophyIconUrl ?? null,
          type: normalizeType(d?.trophyType),
          hidden: !!d?.trophyHidden,
          rarityPct:
            typeof d?.trophyEarnedRate === "string"
              ? parseFloat(d.trophyEarnedRate)
              : typeof d?.trophyEarnedRate === "number"
              ? d.trophyEarnedRate
              : null,
          earned: !!e?.earned,
          earnedAt: e?.earnedDateTime ?? null,
        };
      })
      .filter((t): t is TrophyRow => t !== null);
  }

  let rows = await tryService(npServiceNameHint);
  if (rows.length === 0) {
    const other = npServiceNameHint === "trophy" ? "trophy2" : "trophy";
    rows = await tryService(other);
  }
  return rows;
}

// --- Writing a sync result to the database -----------------------------

export interface ApplySyncResult {
  gameId: string;
  title: string;
  trophyCount: number;
  earnedCount: number;
  platinumEarned: boolean;
}

// Links `gameId` to a PSN title (if not already) and replaces its
// trophy list with a fresh sync. Trophies are deleted and recreated each
// time rather than diffed — earned status/dates always come straight
// from PSN, so there's nothing worth preserving across a resync, and it
// sidesteps id drift if Sony ever reorders a trophy list.
//
// Also re-linked to fix a bad match (Settings -> PlayStation trophies'
// suggestions are fuzzy title matches and occasionally pick the wrong
// game): if the *previous* link had wrongly earned a platinum, the fresh
// sync's platinumEarned will now be false, so playStatus is corrected
// back down. Only ever touches a "platinum" status this same sync
// mechanism could have set — a status chosen by hand any other way is
// left alone.
export async function applyTrophySync(
  creds: PsnCredentials,
  gameId: string,
  npCommunicationId: string,
  npServiceName: "trophy" | "trophy2",
  titleName: string
): Promise<ApplySyncResult> {
  const [rows, game] = await Promise.all([
    syncTitleTrophies(creds, npCommunicationId, npServiceName),
    prisma.game.findUnique({ where: { id: gameId }, select: { playStatus: true } }),
  ]);
  const platinumEarned = rows.some((r) => r.type === "platinum" && r.earned);
  const earnedCount = rows.filter((r) => r.earned).length;

  let playStatus: string | undefined;
  if (platinumEarned) {
    playStatus = "platinum";
  } else if (game?.playStatus === "platinum") {
    playStatus = earnedCount > 0 ? "in_progress" : "unplayed";
  }

  await prisma.$transaction([
    prisma.trophy.deleteMany({ where: { gameId } }),
    prisma.trophy.createMany({
      data: rows.map((r) => ({
        gameId,
        psnTrophyId: r.psnTrophyId,
        groupId: r.groupId,
        sortOrder: r.sortOrder,
        name: r.name,
        description: r.description,
        iconUrl: r.iconUrl,
        type: r.type,
        hidden: r.hidden,
        rarityPct: r.rarityPct,
        earned: r.earned,
        earnedAt: r.earnedAt ? new Date(r.earnedAt) : null,
      })),
    }),
    prisma.game.update({
      where: { id: gameId },
      data: {
        psnNpCommunicationId: npCommunicationId,
        psnNpServiceName: npServiceName,
        trophiesSyncedAt: new Date(),
        ...(playStatus ? { playStatus } : {}),
      },
    }),
  ]);

  return {
    gameId,
    title: titleName,
    trophyCount: rows.length,
    earnedCount,
    platinumEarned,
  };
}

// Clears a game's PSN link and deletes its trophies — used when a re-
// match search doesn't turn up the right title and the user just wants
// to unlink rather than pick a wrong one. Doesn't touch playStatus: with
// no new match to compare against there's nothing reliable to set it to.
export async function unlinkTrophies(gameId: string): Promise<void> {
  await prisma.$transaction([
    prisma.trophy.deleteMany({ where: { gameId } }),
    prisma.game.update({
      where: { id: gameId },
      data: {
        psnNpCommunicationId: null,
        psnNpServiceName: null,
        trophiesSyncedAt: null,
      },
    }),
  ]);
}
