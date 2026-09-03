import { prisma } from "@/lib/prisma";
import { getUpcomingReleases, type UpcomingRelease } from "@/lib/igdb";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  let releases: UpcomingRelease[] = [];
  let error: string | null = null;
  try {
    releases = await getUpcomingReleases(9);
  } catch (e: any) {
    error = e?.message || "Couldn't load upcoming releases from IGDB.";
  }

  const [ownedRows, existingRows] = await Promise.all([
    prisma.game.findMany({
      where: { wishlist: false },
      select: { platform: true },
      distinct: ["platform"],
    }),
    prisma.game.findMany({
      where: { igdbId: { not: null } },
      select: { igdbId: true },
    }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-parchment">
        Release Calendar
      </h1>
      <p className="mt-1 text-sm text-mute">
        Upcoming games from IGDB. Tap one to wishlist it on a platform of your
        choice.
      </p>

      {error ? (
        <p className="mt-6 rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : releases.length === 0 ? (
        <p className="mt-6 text-sm text-mute">
          IGDB returned no upcoming releases. Check that IGDB is enabled in
          Settings and try again shortly.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-mute">
            {releases.length} upcoming releases in the next 9 months.
          </p>
          <CalendarView
            releases={releases}
            ownedPlatforms={ownedRows.map((r) => r.platform)}
            existingIgdbIds={existingRows.map((r) => r.igdbId as number)}
          />
        </>
      )}
    </div>
  );
}
