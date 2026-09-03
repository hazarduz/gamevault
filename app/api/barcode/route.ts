import { NextRequest, NextResponse } from "next/server";
import { lookupBarcode } from "@/lib/barcode";

export const dynamic = "force-dynamic";

// GET /api/barcode?code=045496590475
// Resolves a scanned UPC/EAN to a product title for the Add a game
// screen. Auth is enforced by middleware.ts (non-/api/auth/ paths 401
// without a session).
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim();

  if (!/^\d{8,14}$/.test(code)) {
    return NextResponse.json(
      { error: "A numeric barcode (8–14 digits) is required" },
      { status: 400 }
    );
  }

  try {
    const result = await lookupBarcode(code);
    if (!result) {
      return NextResponse.json(
        { error: "No product found for that barcode — search by title instead" },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
