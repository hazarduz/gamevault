import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// DELETE — remove a user and (via cascade) all their games.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  if (params.id === admin!.id) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 }
    );
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
  } catch {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// PATCH — regenerate the invite link for a still-pending user.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.passwordHash) {
    return NextResponse.json(
      { error: "That user has already set a password." },
      { status: 400 }
    );
  }

  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: params.id },
    data: {
      inviteToken: token,
      inviteExpiresAt: new Date(Date.now() + 7 * 864e5),
    },
  });

  return NextResponse.json({ inviteUrl: `${req.nextUrl.origin}/invite/${token}` });
}
