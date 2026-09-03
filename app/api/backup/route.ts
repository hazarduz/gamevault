import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs, updateUserPrefs } from "@/lib/prefs";
import {
  EXPORT_VERSION,
  serializeGame,
  gameCreateInput,
  sanitizeImportedPrefs,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

const MAX_GAMES = 20000;

// GET /api/backup — download this account's games + preferences as JSON.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [games, prefs] = await Promise.all([
    prisma.game.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getUserPrefs(user.id),
  ]);

  const body = {
    version: EXPORT_VERSION,
    kind: "user",
    exportedAt: new Date().toISOString(),
    username: user.username,
    prefs: {
      scoreBadgeEnabled: prefs.scoreBadgeEnabled,
      scoreBadgeBands: prefs.scoreBadgeBands,
      statusBadgeEnabled: prefs.statusBadgeEnabled,
      statusColors: prefs.statusColors,
      dimCompleted: prefs.dimCompleted,
      dimPlayedPreviously: prefs.dimPlayedPreviously,
      dimStrength: prefs.dimStrength,
      psnEnabled: prefs.psnEnabled,
      psnOnlineId: prefs.psnOnlineId,
      psnNpsso: prefs.psnNpsso,
    },
    games: games.map(serializeGame),
  };

  const filename = `gamevault-${user.username}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// POST /api/backup { mode: "merge" | "replace", data: <export object> }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const mode = payload?.mode === "replace" ? "replace" : "merge";
  const data = payload?.data;
  if (!data || typeof data !== "object" || !Array.isArray(data.games)) {
    return NextResponse.json(
      { error: "That doesn't look like a GameVault backup file." },
      { status: 400 }
    );
  }
  if (data.games.length > MAX_GAMES) {
    return NextResponse.json({ error: "That file has too many games." }, { status: 400 });
  }

  try {
    if (data.prefs && typeof data.prefs === "object") {
      await updateUserPrefs(user.id, sanitizeImportedPrefs(data.prefs));
    }

    if (mode === "replace") {
      await prisma.game.deleteMany({ where: { userId: user.id } });
    }

    const existing =
      mode === "merge"
        ? await prisma.game.findMany({
            where: { userId: user.id },
            select: { igdbId: true, title: true, platform: true },
          })
        : [];
    const seenIgdb = new Set<number>(
      existing.filter((e) => e.igdbId != null).map((e) => e.igdbId as number)
    );
    const seenKey = new Set<string>(
      existing.map((e) => `${e.title.toLowerCase()}|${e.platform.toLowerCase()}`)
    );

    const rows: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const raw of data.games) {
      let input: Record<string, unknown>;
      try {
        input = gameCreateInput(raw, user.id);
      } catch {
        skipped++;
        continue;
      }
      const igdbId = input.igdbId as number | null;
      const key = `${String(input.title).toLowerCase()}|${String(input.platform).toLowerCase()}`;
      if (igdbId != null) {
        if (seenIgdb.has(igdbId)) {
          skipped++;
          continue;
        }
        seenIgdb.add(igdbId);
      } else if (seenKey.has(key)) {
        skipped++;
        continue;
      }
      seenKey.add(key);
      rows.push(input);
    }

    let imported = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const res = await prisma.game.createMany({ data: rows.slice(i, i + 500) as any });
      imported += res.count;
    }

    return NextResponse.json({ mode, imported, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
