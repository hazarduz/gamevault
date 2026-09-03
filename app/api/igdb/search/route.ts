import { NextRequest, NextResponse } from "next/server";
import { searchIgdbGames, getIgdbGameDetail } from "@/lib/igdb";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const igdbId = req.nextUrl.searchParams.get("igdbId");

  try {
    if (igdbId) {
      const detail = await getIgdbGameDetail(parseInt(igdbId, 10));
      return NextResponse.json(detail);
    }

    if (!q) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const results = await searchIgdbGames(q);
    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
