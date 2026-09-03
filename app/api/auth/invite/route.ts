import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/session-token";

export const dynamic = "force-dynamic";

// GET /api/auth/invite?token=... — is this invite usable? (drives the
// set-password page)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const user = token
    ? await prisma.user.findUnique({ where: { inviteToken: token } })
    : null;

  const valid =
    !!user &&
    !user.passwordHash &&
    (!user.inviteExpiresAt || user.inviteExpiresAt.getTime() > Date.now());

  return NextResponse.json({
    valid,
    username: valid ? user!.username : null,
  });
}

// POST /api/auth/invite { token, password } — set the password and sign in.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const user = token
    ? await prisma.user.findUnique({ where: { inviteToken: token } })
    : null;
  if (
    !user ||
    user.passwordHash ||
    (user.inviteExpiresAt && user.inviteExpiresAt.getTime() < Date.now())
  ) {
    return NextResponse.json(
      { error: "This invite link is no longer valid." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  const sessionToken = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  setSessionCookie(req, res, sessionToken);
  return res;
}
