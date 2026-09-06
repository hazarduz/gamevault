import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/hltb?q=<title> — search-only HowLongToBeat lookup, no DB
// write (unlike /api/enrich/hltb which is tied to a game row). The Game
// Picker calls this to fill in times after a pick has rendered.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  try {
    const { searchHltb } = await import("@/lib/hltb");
    const top = (await searchHltb(q))[0] ?? null;
    return NextResponse.json({
      result: top
        ? {
            mainHours: top.mainHours,
            mainExtraHours: top.mainExtraHours,
            completionistHours: top.completionistHours,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
