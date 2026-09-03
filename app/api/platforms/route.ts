import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/platforms — owned platforms (wishlist excluded) with counts,
// alphabetical. Feeds the sidebar's Platforms list and the calendar's
// platform filter default.
export async function GET() {
  const rows = await prisma.game.groupBy({
    by: ["platform"],
    where: { wishlist: false },
    _count: { _all: true },
    orderBy: { platform: "asc" },
  });

  return NextResponse.json(
    rows.map((r) => ({ platform: r.platform, count: r._count._all }))
  );
}
