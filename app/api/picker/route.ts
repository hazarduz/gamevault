import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { lengthBand } from "@/lib/picker-filters";
import type { PickerCandidate } from "@/lib/igdb";

export const dynamic = "force-dynamic";

// GET /api/picker?platform=<igdbId>&genre=<igdbId>&length=<band>
// One random game you could play: not in your collection, or in it as
// "unplayed". Filters are all optional. When `length` is set, candidates
// are checked against HowLongToBeat's main-story time until one fits.
// Add ?debug=1 to see the IGDB query diagnostics instead.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const platformId = Number(sp.get("platform")) || null;
  const genreId = Number(sp.get("genre")) || null;
  const band = lengthBand(sp.get("length"));
  const debugMode = sp.get("debug") === "1";

  try {
    const rows = await prisma.game.findMany({
      where: { userId: user.id, igdbId: { not: null } },
      select: { id: true, igdbId: true, wishlist: true, playlist: true, playStatus: true },
    });

    const exclude = new Set<number>();
    const ownedUnplayed = new Map<number, string>();
    for (const g of rows) {
      const id = g.igdbId as number;
      if (g.wishlist || g.playlist || g.playStatus !== "unplayed") exclude.add(id);
      else ownedUnplayed.set(id, g.id);
    }

    const { getRandomGames } = await import("@/lib/igdb");
    const { searchHltb } = await import("@/lib/hltb");

    const debugPasses: unknown[] = [];
    let picked: PickerCandidate | null = null;
    let pickedHltb: {
      mainHours: number | null;
      mainExtraHours: number | null;
      completionistHours: number | null;
    } | null = null;
    let hltbLookups = 0;
    const HLTB_BUDGET = 10;

    for (let pass = 0; pass < 4 && !picked; pass++) {
      const { games, debug } = await getRandomGames({ platformId, genreId });
      debugPasses.push(debug);

      let eligible = games.filter((c) => !exclude.has(c.igdbId));
      // shuffle so the same offset page doesn't always yield the same pick
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }

      if (!band) {
        if (eligible.length > 0) picked = eligible[0];
        continue;
      }

      // Length filter: check candidates against HLTB until one fits.
      for (const cand of eligible) {
        if (hltbLookups >= HLTB_BUDGET) break;
        hltbLookups++;
        try {
          const top = (await searchHltb(cand.title))[0];
          const main = top?.mainHours ?? null;
          if (main != null && main >= band.min && main <= band.max) {
            picked = cand;
            pickedHltb = {
              mainHours: top.mainHours,
              mainExtraHours: top.mainExtraHours,
              completionistHours: top.completionistHours,
            };
            break;
          }
        } catch {
          // HLTB flaked — skip this candidate.
        }
      }
    }

    if (debugMode) {
      return NextResponse.json({
        filters: { platformId, genreId, length: band?.value ?? null },
        passes: debugPasses,
        excludedCount: exclude.size,
        picked: picked ? { igdbId: picked.igdbId, title: picked.title } : null,
      });
    }

    if (!picked) {
      return NextResponse.json({
        game: null,
        reason:
          band != null
            ? "No game in that time range turned up — widen the length filter or re-pick."
            : platformId || genreId
            ? "Nothing matched those filters — loosen them or re-pick."
            : "The roll came up empty — try again.",
      });
    }

    return NextResponse.json({
      game: picked,
      ownedGameId: ownedUnplayed.get(picked.igdbId) ?? null,
      hltb: pickedHltb,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
