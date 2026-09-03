import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const INVITE_TTL_DAYS = 7;

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      passwordHash: true,
      inviteToken: true,
      inviteExpiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      pending: !u.passwordHash,
      inviteToken: u.passwordHash ? null : u.inviteToken,
      inviteExpired:
        !u.passwordHash &&
        !!u.inviteExpiresAt &&
        u.inviteExpiresAt.getTime() < Date.now(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (username.length < 2) {
    return NextResponse.json(
      { error: "Username must be at least 2 characters." },
      { status: 400 }
    );
  }

  const clash = await prisma.user.findUnique({ where: { username } });
  if (clash) {
    return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  }

  const token = randomBytes(24).toString("hex");
  await prisma.user.create({
    data: {
      username,
      passwordHash: "",
      role: "user",
      inviteToken: token,
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 864e5),
    },
  });

  const origin = req.nextUrl.origin;
  return NextResponse.json(
    { username, inviteUrl: `${origin}/invite/${token}` },
    { status: 201 }
  );
}
