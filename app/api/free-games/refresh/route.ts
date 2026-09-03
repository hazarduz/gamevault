import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/free-games/refresh — force a re-fetch of the Currently Free
// feed, bypassing the cache TTL, and return the fresh result. Backs the
// "Refresh now" button. Any signed-in user can trigger it; the result is
// cached instance-wide so it's cheap.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { getFreeGames } = await import("@/lib/free-games");
    const result = await getFreeGames({ force: true });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
