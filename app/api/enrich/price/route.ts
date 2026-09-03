import { NextRequest, NextResponse } from "next/server";
import { findPriceChartingMatch, usdToGbp } from "@/lib/pricecharting";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { gameId, title, platform, region } = await req.json();

  if (!title || !platform) {
    return NextResponse.json(
      { error: "title and platform are required" },
      { status: 400 }
    );
  }

  try {
    const match = await findPriceChartingMatch(title, platform, region);
    if (!match) {
      return NextResponse.json(
        { error: "No PriceCharting match found — try entering the value manually" },
        { status: 404 }
      );
    }

    const [loose, cib, brandNew] = await Promise.all([
      usdToGbp(match.loose),
      usdToGbp(match.cib),
      usdToGbp(match.new),
    ]);

    if (gameId) {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          valueLooseGbp: loose,
          valueCibGbp: cib,
          valueNewGbp: brandNew,
          valueUpdatedAt: new Date(),
          valueSource: "pricecharting",
        },
      });
    }

    return NextResponse.json({
      productUrl: match.productUrl,
      matchedTitle: match.title,
      loose,
      cib,
      new: brandNew,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
