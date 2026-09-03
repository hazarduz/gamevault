import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Without this, Next.js tries to pre-render this route at build time
// (to cache it as static), which fails the Docker build since there's
// no database available during the build — only at runtime.
export const dynamic = "force-dynamic";

export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ hasUser: count > 0 });
}
