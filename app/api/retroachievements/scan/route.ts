import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// POST /api/retroachievements/scan — read-only. For every collection
// game that isn't already linked (raGameId null), resolves its platform
// to an RA console (skipping platforms RA has no console for — most
// modern ones) and searches that console's game list for name matches.
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const prefs = await getUserPrefs(user.id);
    const creds = { raEnabled: prefs.raEnabled, raUsername: prefs.raUsername, raApiKey: prefs.raApiKey };

    const games = await prisma.game.findMany({
      where: { userId: user.id, raGameId: null },
      select: { id: true, title: true, platform: true },
      orderBy: { title: "asc" },
    });

    const { getRaConsoleList, matchConsoleForPlatform, getRaGameList, searchRaGameList } =
      await import("@/lib/retroachievements");

    const consoles = await getRaConsoleList(creds);
    const consoleByPlatform = new Map<string, ReturnType<typeof matchConsoleForPlatform>>();
    const gameListByConsole = new Map<number, Awaited<ReturnType<typeof getRaGameList>>>();

    const proposals: {
      gameId: string;
      title: string;
      platform: string;
      matches: { id: number; title: string; iconUrl: string | null; exact: boolean }[];
    }[] = [];
    let noConsole = 0;

    for (const g of games) {
      if (!consoleByPlatform.has(g.platform)) {
        consoleByPlatform.set(g.platform, matchConsoleForPlatform(g.platform, consoles));
      }
      const matchedConsole = consoleByPlatform.get(g.platform);
      if (!matchedConsole) {
        noConsole++;
        continue;
      }

      if (!gameListByConsole.has(matchedConsole.id)) {
        gameListByConsole.set(matchedConsole.id, await getRaGameList(matchedConsole.id, creds));
      }
      const list = gameListByConsole.get(matchedConsole.id)!;
      const matches = searchRaGameList(g.title, list, 6);
      if (matches.length > 0) {
        proposals.push({ gameId: g.id, title: g.title, platform: g.platform, matches });
      }
    }

    return NextResponse.json({ proposals, noConsole });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
