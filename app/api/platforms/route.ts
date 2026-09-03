import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/platforms — the signed-in user's platforms (wishlist excluded)
// with counts, alphabetical. Feeds the sidebar's Platforms list and the
// calendar's platform filter default.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const rows = await prisma.game.groupBy({
    by: ["platform"],
    where: { userId: user.id, wishlist: false },
    _count: { _all: true },
    orderBy: { platform: "asc" },
  });

  return NextResponse.json(
    rows.map((r) => ({ platform: r.platform, count: r._count._all }))
  );
}
