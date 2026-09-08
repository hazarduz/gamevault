import { TrophyTier } from "@/types/game";

// PSN's own per-tier trophy colors — kept in sync with the web app's
// lib/trophy-colors.ts and components/PlatformStatsBanner.tsx.
export const TROPHY_TIER_COLORS: Record<TrophyTier, string> = {
  platinum: "#a7c7e7",
  gold: "#e6b422",
  silver: "#c0c0c0",
  bronze: "#cd7f32",
};
