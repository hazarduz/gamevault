import { prisma } from "@/lib/prisma";

// Per-user display preferences + PlayStation credentials. Mirrors
// lib/settings.ts but keyed by userId, created on first read.
export async function getUserPrefs(userId: string) {
  const existing = await prisma.userPrefs.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.userPrefs.create({ data: { userId } });
}

export async function updateUserPrefs(
  userId: string,
  data: {
    scoreBadgeEnabled?: boolean;
    scoreBadgeBands?: string | null;
    statusBadgeEnabled?: boolean;
    statusColors?: string | null;
    dimCompleted?: boolean;
    dimPlayedPreviously?: boolean;
    dimStrength?: number;
    psnEnabled?: boolean;
    psnOnlineId?: string | null;
    psnNpsso?: string | null;
  }
) {
  await getUserPrefs(userId); // ensure the row exists
  return prisma.userPrefs.update({ where: { userId }, data });
}
