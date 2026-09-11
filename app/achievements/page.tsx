import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { getPsnTrophySummary } from "@/lib/psn";
import { TROPHY_TIER_COLORS, TROPHY_TIER_LABELS, type TrophyTier } from "@/lib/trophy-colors";
import AchievementsFilters from "@/components/AchievementsFilters";

export const dynamic = "force-dynamic";

type Kind = "trophy" | "achievement" | "retroachievement";

interface FeedItem {
  key: string;
  kind: Kind;
  name: string;
  iconUrl: string | null;
  earnedAt: string | null;
  tier: TrophyTier | null; // trophies only
  points: number | null; // RetroAchievements only
  game: { id: string; title: string; platform: string };
}

const KIND_LABELS: Record<Kind, string> = {
  trophy: "PSN Trophy",
  achievement: "Steam Achievement",
  retroachievement: "RetroAchievement",
};

const KIND_BADGE_COLOR: Record<Kind, string> = {
  trophy: "bg-sky-500/20 text-sky-300",
  achievement: "bg-slate-500/20 text-slate-300",
  retroachievement: "bg-amber/20 text-amber",
};

export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: { kind?: string; platform?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const kind = searchParams.kind?.trim();
  const platform = searchParams.platform?.trim() || undefined;
  const gameFilter = { userId: user.id, ...(platform ? { platform } : {}) };

  const [trophies, achievements, retroAchievements, platforms, prefs] = await Promise.all([
    kind && kind !== "trophy"
      ? []
      : prisma.trophy.findMany({
          where: { earned: true, game: gameFilter },
          include: { game: { select: { id: true, title: true, platform: true } } },
          orderBy: { earnedAt: "desc" },
          take: 150,
        }),
    kind && kind !== "achievement"
      ? []
      : prisma.achievement.findMany({
          where: { earned: true, game: gameFilter },
          include: { game: { select: { id: true, title: true, platform: true } } },
          orderBy: { earnedAt: "desc" },
          take: 150,
        }),
    kind && kind !== "retroachievement"
      ? []
      : prisma.retroAchievement.findMany({
          where: { earned: true, game: gameFilter },
          include: { game: { select: { id: true, title: true, platform: true } } },
          orderBy: { earnedAt: "desc" },
          take: 150,
        }),
    prisma.game
      .findMany({ where: { userId: user.id }, select: { platform: true }, distinct: ["platform"] })
      .then((rows) => rows.map((r) => r.platform).sort()),
    getUserPrefs(user.id),
  ]);

  const feed: FeedItem[] = [
    ...trophies.map((t): FeedItem => ({
      key: `trophy-${t.id}`,
      kind: "trophy",
      name: t.name,
      iconUrl: t.iconUrl,
      earnedAt: t.earnedAt?.toISOString() ?? null,
      tier: t.type as TrophyTier,
      points: null,
      game: t.game,
    })),
    ...achievements.map((a): FeedItem => ({
      key: `achievement-${a.id}`,
      kind: "achievement",
      name: a.name,
      iconUrl: a.iconUrl,
      earnedAt: a.earnedAt?.toISOString() ?? null,
      tier: null,
      points: null,
      game: a.game,
    })),
    ...retroAchievements.map((r): FeedItem => ({
      key: `retro-${r.id}`,
      kind: "retroachievement",
      name: r.name,
      iconUrl: r.iconUrl,
      earnedAt: r.earnedAt?.toISOString() ?? null,
      tier: null,
      points: r.points,
      game: r.game,
    })),
  ]
    .sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))
    .slice(0, 200);

  const [trophyTotal, achievementTotal, retroAchievementTotal] = await Promise.all([
    prisma.trophy.count({ where: { earned: true, game: { userId: user.id } } }),
    prisma.achievement.count({ where: { earned: true, game: { userId: user.id } } }),
    prisma.retroAchievement.count({ where: { earned: true, game: { userId: user.id } } }),
  ]);
  const totals = {
    trophies: trophyTotal,
    achievements: achievementTotal,
    retroAchievements: retroAchievementTotal,
  };

  const psnStats =
    prefs.psnEnabled && prefs.psnNpsso
      ? await getPsnTrophySummary({
          psnEnabled: prefs.psnEnabled,
          psnOnlineId: prefs.psnOnlineId,
          psnNpsso: prefs.psnNpsso,
        }).catch(() => null)
      : null;

  const raStats =
    prefs.raEnabled && prefs.raUsername && prefs.raApiKey
      ? await (async () => {
          const { getRaUserSummary } = await import("@/lib/retroachievements");
          return getRaUserSummary({
            raEnabled: prefs.raEnabled,
            raUsername: prefs.raUsername,
            raApiKey: prefs.raApiKey,
          }).catch(() => null);
        })()
      : null;

  const profileLinks = [
    prefs.raUsername
      ? { label: "RetroAchievements", href: `https://retroachievements.org/user/${encodeURIComponent(prefs.raUsername)}` }
      : null,
    prefs.exophaseUrl ? { label: "Exophase", href: prefs.exophaseUrl } : null,
    prefs.psnProfilesUrl ? { label: "PSNProfiles", href: prefs.psnProfilesUrl } : null,
  ].filter((l): l is { label: string; href: string } => l !== null);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-parchment">Achievements</h1>
          <p className="mt-1 text-sm text-mute">
            {totals.trophies + totals.achievements + totals.retroAchievements} unlocked across your
            collection
          </p>
        </div>
        <AchievementsFilters platforms={platforms} />
      </div>

      {/* --- Summary stats --- */}
      <div className="mb-6 flex flex-wrap gap-4">
        <StatCard label="PSN Trophies" value={totals.trophies} />
        <StatCard label="Steam Achievements" value={totals.achievements} />
        <StatCard label="RetroAchievements" value={totals.retroAchievements} />
        {psnStats && <StatCard label="PSN Level" value={psnStats.trophyLevel} />}
        {raStats && <StatCard label="RA Points" value={raStats.totalPoints} />}
      </div>

      {profileLinks.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-mute">Profiles:</span>
          {profileLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-ink-line bg-ink-soft px-3 py-1 text-xs text-parchment transition hover:border-mute"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      )}

      {/* --- Feed --- */}
      {feed.length === 0 ? (
        <p className="mt-8 text-sm text-mute">
          Nothing earned yet — sync PSN trophies, Steam achievements, or RetroAchievements from{" "}
          <Link href="/settings" className="text-amber underline">
            Settings
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-1.5">
          {feed.map((item) => (
            <Link
              key={item.key}
              href={`/games/${item.game.id}`}
              className="flex items-center gap-3 rounded-md border border-ink-line bg-ink-soft px-3 py-2 transition hover:border-mute"
            >
              <div
                className={`relative h-10 w-10 flex-shrink-0 overflow-hidden rounded border-2 bg-ink-softer ${
                  item.tier ? "" : "border-ink-line"
                }`}
                style={item.tier ? { borderColor: TROPHY_TIER_COLORS[item.tier] } : undefined}
              >
                {item.iconUrl && (
                  // Plain <img>: icon hosts vary per service (PSN, Steam,
                  // RA) and aren't worth maintaining in next.config.
                  <img src={item.iconUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-parchment">{item.name}</p>
                <p className="truncate text-xs text-mute">
                  {item.game.title} · {item.game.platform}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right text-xs text-mute">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${KIND_BADGE_COLOR[item.kind]}`}
                >
                  {item.tier ? TROPHY_TIER_LABELS[item.tier] : KIND_LABELS[item.kind]}
                </span>
                <span>
                  {item.earnedAt ? new Date(item.earnedAt).toLocaleDateString() : "Earned"}
                  {item.points != null ? ` · ${item.points} pt${item.points === 1 ? "" : "s"}` : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-ink-line bg-ink-soft px-4 py-3">
      <p className="font-display text-xl font-bold text-parchment">{value.toLocaleString()}</p>
      <p className="text-xs text-mute">{label}</p>
    </div>
  );
}
