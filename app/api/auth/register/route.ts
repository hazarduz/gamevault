import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/session-token";

// Only allowed when no user exists yet — this is a one-time setup step,
// not an open registration endpoint. Once an admin account exists this
// always returns 403.
export async function POST(req: NextRequest) {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "An admin account already exists." },
      { status: 403 }
    );
  }

  const { username, password } = await req.json();

  if (!username || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Username and a password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: "admin" },
  });

  const token = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  setSessionCookie(req, res, token);
  return res;
}
