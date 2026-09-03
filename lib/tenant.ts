import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// One-time-per-process migration for the single-user -> multi-user move.
// Called from getCurrentUser() (lib/session.ts) once a user is resolved.
let bootstrapped = false;

export async function ensureTenancy(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    const users = await prisma.user.findMany({
      select: { id: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    if (users.length === 0) {
      bootstrapped = false; // nothing to do yet; retry after first register
      return;
    }

    // The founding account is the admin.
    let admin = users.find((u) => u.role === "admin");
    if (!admin) {
      admin = users[0];
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: "admin" },
      });
    }

    // Claim any pre-multi-user games for the admin.
    await prisma.game.updateMany({
      where: { userId: null },
      data: { userId: admin.id },
    });

    // Migrate the old singleton Settings' per-user fields into the
    // admin's UserPrefs, once.
    const hasPrefs = await prisma.userPrefs.findUnique({
      where: { userId: admin.id },
    });
    if (!hasPrefs) {
      const s = await prisma.settings.findUnique({ where: { id: "singleton" } });
      await prisma.userPrefs.create({
        data: {
          userId: admin.id,
          scoreBadgeEnabled: s?.scoreBadgeEnabled ?? true,
          scoreBadgeBands: s?.scoreBadgeBands ?? null,
          statusBadgeEnabled: s?.statusBadgeEnabled ?? true,
          statusColors: s?.statusColors ?? null,
          dimCompleted: s?.dimCompleted ?? true,
          psnEnabled: s?.psnEnabled ?? false,
          psnOnlineId: s?.psnOnlineId ?? null,
          psnNpsso: s?.psnNpsso ?? null,
        },
      });
    }
  } catch {
    // Columns/tables may not exist yet mid-deploy — let a later request retry.
    bootstrapped = false;
  }
}

/** True when the user is the admin. */
export function isAdmin(user: Pick<User, "role"> | null | undefined): boolean {
  return !!user && user.role === "admin";
}
