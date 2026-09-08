// PSN's own per-tier trophy colors, shared by the individual trophy list
// (app/games/[id]/page.tsx) and the account-level summary banner
// (components/PlatformStatsBanner.tsx) so the two never drift apart.
export const TROPHY_TIER_COLORS = {
  platinum: "#a7c7e7",
  gold: "#e6b422",
  silver: "#c0c0c0",
  bronze: "#cd7f32",
} as const;

export type TrophyTier = keyof typeof TROPHY_TIER_COLORS;

export const TROPHY_TIER_LABELS: Record<TrophyTier, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};
