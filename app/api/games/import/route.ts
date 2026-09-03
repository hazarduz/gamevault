import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import type { IgdbGameDetail } from "@/lib/igdb";

export const dynamic = "force-dynamic";

const MAX = 1000;

// POST /api/games/import { games: [{ igdbId?, title, platform, format?, steamAppId? }] }
// Bulk-create from a review table (photo import, Steam library import).
// Dedupes against the user's collection and within the payload — by
// igdbId, by steamAppId, and by title+platform — and rows with an igdbId
// get full IGDB metadata in one batch call.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const list = Array.isArray(body?.games) ? body.games.slice(0, MAX) : null;
  if (!list || list.length === 0) {
    return NextResponse.json({ error: "No games to import." }, { status: 400 });
  }

  try {
    const existing = await prisma.game.findMany({
      where: { userId: user.id },
      select: { igdbId: true, steamAppId: true, title: true, platform: true },
    });
    const haveIgdb = new Set(
      existing.filter((e) => e.igdbId != null).map((e) => e.igdbId as number)
    );
    const haveSteam = new Set(
      existing.filter((e) => e.steamAppId != null).map((e) => e.steamAppId as number)
    );
    const haveKey = new Set(
      existing.map((e) => `${e.title.toLowerCase()}|${e.platform.toLowerCase()}`)
    );

    type Row = {
      igdbId: number | null;
      steamAppId: number | null;
      title: string;
      platform: string;
      format: "Physical" | "Digital";
    };
    const rows: Row[] = [];
    let skipped = 0;

    for (const raw of list) {
      const title = String(raw?.title ?? "").trim();
      const platform = String(raw?.platform ?? "").trim();
      if (!title || !platform) {
        skipped++;
        continue;
      }
      const n = Number(raw?.igdbId);
      const igdbId = Number.isInteger(n) && n > 0 ? n : null;
      const s = Number(raw?.steamAppId);
      const steamAppId = Number.isInteger(s) && s > 0 ? s : null;
      const format: "Physical" | "Digital" =
        raw?.format === "Digital" ? "Digital" : "Physical";
      const key = `${title.toLowerCase()}|${platform.toLowerCase()}`;

      if (steamAppId != null && haveSteam.has(steamAppId)) {
        skipped++;
        continue;
      }
      if (igdbId != null) {
        if (haveIgdb.has(igdbId)) {
          skipped++;
          continue;
        }
        haveIgdb.add(igdbId);
      } else if (haveKey.has(key)) {
        skipped++;
        continue;
      }
      if (steamAppId != null) haveSteam.add(steamAppId);
      haveKey.add(key);
      rows.push({ igdbId, steamAppId, title, platform, format });
    }

    if (rows.length === 0) {
      return NextResponse.json({ imported: 0, skipped });
    }

    // One IGDB call for every matched row.
    let details = new Map<number, IgdbGameDetail>();
    const idsToFetch = rows
      .map((r) => r.igdbId)
      .filter((v): v is number => v != null);
    if (idsToFetch.length > 0) {
      try {
        const { getIgdbGameDetailsBatch } = await import("@/lib/igdb");
        details = await getIgdbGameDetailsBatch(idsToFetch);
      } catch {
        // IGDB unavailable — fall back to bare title/platform.
      }
    }

    const data = rows.map((r) => {
      const d = r.igdbId != null ? details.get(r.igdbId) : undefined;
      return {
        userId: user.id,
        title: d?.title ?? r.title,
        platform: r.platform,
        format: r.format,
        igdbId: r.igdbId,
        steamAppId: r.steamAppId,
        coverUrl: d?.coverUrl ?? null,
        releaseDate: d?.releaseDate ? new Date(d.releaseDate) : null,
        summary: d?.summary ?? null,
        genres: d?.genres ?? [],
        developer: d?.developer ?? null,
        publisher: d?.publisher ?? null,
        aggregatedRating: d?.aggregatedRating ?? null,
      };
    });

    let imported = 0;
    for (let i = 0; i < data.length; i += 200) {
      const res = await prisma.game.createMany({
        data: data.slice(i, i + 200) as any,
        skipDuplicates: true, // race-safe against the per-user unique indexes
      });
      imported += res.count;
    }

    return NextResponse.json({ imported, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
