import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

interface LinkRequest {
  gameId: string;
  raGameId: number;
}

// POST /api/retroachievements/apply { links: [{ gameId, raGameId }] }
// Links each chosen game to an RA game id and pulls its achievement list.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const prefs = await getUserPrefs(user.id);
  const creds = { raEnabled: prefs.raEnabled, raUsername: prefs.raUsername, raApiKey: prefs.raApiKey };

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const links: unknown = body?.links;
  if (!Array.isArray(links) || links.length === 0) {
    return NextResponse.json({ error: "links must be a non-empty array" }, { status: 400 });
  }

  const clean: LinkRequest[] = [];
  for (const l of links as any[]) {
    const raGameId = Number(l?.raGameId);
    if (typeof l?.gameId === "string" && l.gameId && Number.isInteger(raGameId) && raGameId > 0) {
      clean.push({ gameId: l.gameId, raGameId });
    }
  }
  if (clean.length === 0) {
    return NextResponse.json({ error: "No valid links to apply." }, { status: 400 });
  }

  const owned = new Set(
    (
      await prisma.game.findMany({
        where: { userId: user.id, id: { in: clean.map((l) => l.gameId) } },
        select: { id: true },
      })
    ).map((g) => g.id)
  );

  const { applyRaSync } = await import("@/lib/retroachievements");

  let linked = 0;
  const errors: { gameId: string; message: string }[] = [];

  for (const link of clean) {
    if (!owned.has(link.gameId)) {
      errors.push({ gameId: link.gameId, message: "That game isn't in your collection." });
      continue;
    }
    try {
      await applyRaSync(link.gameId, link.raGameId, creds);
      linked++;
    } catch (e: any) {
      errors.push({ gameId: link.gameId, message: e?.message || String(e) });
    }
  }

  return NextResponse.json({ linked, errors });
}
