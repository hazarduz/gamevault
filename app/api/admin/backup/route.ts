import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/tenant";
import { EXPORT_VERSION, serializeGame, gameCreateInput, sanitizeImportedPrefs } from "@/lib/backup";

export const dynamic = "force-dynamic";

const SETTINGS_FIELDS = [
  "igdbEnabled",
  "twitchClientId",
  "twitchClientSecret",
  "hltbEnabled",
  "priceChartingEnabled",
  "currencyApiUrl",
] as const;

// GET /api/admin/backup — a full dump of the whole instance: every
// account (with password hashes and PSN tokens), everyone's games, and
// the instance integration settings. Admin only.
export async function GET() {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const [settings, users] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { prefs: true, games: { orderBy: { createdAt: "asc" } } },
    }),
  ]);

  const settingsOut: Record<string, unknown> = {};
  for (const f of SETTINGS_FIELDS) {
    settingsOut[f] = settings ? (settings as Record<string, unknown>)[f] : null;
  }

  const body = {
    version: EXPORT_VERSION,
    kind: "instance",
    exportedAt: new Date().toISOString(),
    settings: settingsOut,
    users: users.map((u) => ({
      username: u.username,
      passwordHash: u.passwordHash,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      prefs: u.prefs
        ? {
            scoreBadgeEnabled: u.prefs.scoreBadgeEnabled,
            scoreBadgeBands: u.prefs.scoreBadgeBands,
            statusBadgeEnabled: u.prefs.statusBadgeEnabled,
            statusColors: u.prefs.statusColors,
            dimCompleted: u.prefs.dimCompleted,
            dimPlayedPreviously: u.prefs.dimPlayedPreviously,
            dimStrength: u.prefs.dimStrength,
            psnEnabled: u.prefs.psnEnabled,
            psnOnlineId: u.prefs.psnOnlineId,
            psnNpsso: u.prefs.psnNpsso,
          }
        : null,
      games: u.games.map(serializeGame),
    })),
  };

  const filename = `gamevault-instance-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// POST /api/admin/backup { data } — wipe and restore the whole instance
// from a dump. Admin only. Logs everyone out (accounts are recreated).
export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const data = payload?.data;
  if (
    !data ||
    typeof data !== "object" ||
    data.kind !== "instance" ||
    !Array.isArray(data.users)
  ) {
    return NextResponse.json(
      { error: "That isn't a full-instance GameVault backup." },
      { status: 400 }
    );
  }
  if (data.users.length === 0) {
    return NextResponse.json({ error: "The backup has no accounts." }, { status: 400 });
  }

  const settingsIn: Record<string, unknown> = {};
  if (data.settings && typeof data.settings === "object") {
    for (const f of SETTINGS_FIELDS) {
      const v = (data.settings as Record<string, unknown>)[f];
      if (typeof v === "boolean" || typeof v === "string" || v === null) settingsIn[f] = v;
    }
  }

  const anyAdmin = data.users.some((u: any) => u?.role === "admin");

  try {
    let users = 0;
    let games = 0;

    await prisma.$transaction(
      async (tx) => {
        await tx.user.deleteMany({}); // cascades games + prefs

        await tx.settings.upsert({
          where: { id: "singleton" },
          update: settingsIn as any,
          create: { id: "singleton", ...settingsIn } as any,
        });

        for (let i = 0; i < data.users.length; i++) {
          const u = data.users[i];
          const username = String(u?.username ?? "").trim();
          const passwordHash = String(u?.passwordHash ?? "");
          if (!username) throw new Error("An account in the backup has no username.");

          const created = await tx.user.create({
            data: {
              username,
              passwordHash,
              role: anyAdmin ? (u.role === "admin" ? "admin" : "user") : i === 0 ? "admin" : "user",
              createdAt: u?.createdAt ? new Date(u.createdAt) : undefined,
            },
          });
          users++;

          if (u?.prefs && typeof u.prefs === "object") {
            await tx.userPrefs.create({
              data: { userId: created.id, ...sanitizeImportedPrefs(u.prefs) } as any,
            });
          }

          const rows = Array.isArray(u?.games)
            ? u.games
                .map((g: unknown) => {
                  try {
                    return gameCreateInput(g, created.id);
                  } catch {
                    return null;
                  }
                })
                .filter(Boolean)
            : [];
          for (let j = 0; j < rows.length; j += 500) {
            const res = await tx.game.createMany({ data: rows.slice(j, j + 500) as any });
            games += res.count;
          }
        }
      },
      { timeout: 120000, maxWait: 15000 }
    );

    return NextResponse.json({ ok: true, users, games, loggedOut: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
