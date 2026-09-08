// Mirrors the fields of the `Game` model in the server's
// prisma/schema.prisma that a mobile client actually reads or edits.
// Integration-only fields (Steam/PSN linking ids, HLTB, sync timestamps)
// are passed through opaquely where the remote API returns them, but the
// app never writes them directly.

export type PlayStatus = "unplayed" | "in_progress" | "completed" | "platinum";
export type Format = "Physical" | "Digital";

export type TrophyTier = "bronze" | "silver" | "gold" | "platinum";

export interface Trophy {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  type: TrophyTier;
  earned: boolean;
  earnedAt: string | null;
}

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  earned: boolean;
  earnedAt: string | null;
}

export interface Game {
  id: string;
  title: string;
  platform: string;
  region: string | null;
  condition: string | null;
  format: Format;
  notes: string | null;
  personalRating: number | null;
  playStatus: PlayStatus;
  wishlist: boolean;
  playlist: boolean;
  dateAdded: string;
  datePurchased: string | null;
  purchasePriceGbp: number | null;
  valueLooseGbp: number | null;
  valueCibGbp: number | null;
  valueNewGbp: number | null;
  valueUpdatedAt: string | null;
  valueSource: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
  summary: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  aggregatedRating: number | null;
  metacriticScore: number | null;
  hltbMainHours: number | null;
  trophies?: Trophy[];
  achievements?: Achievement[];
  createdAt: string;
  updatedAt: string;
}

// Fields the "Add Game" form can set. Everything else is either
// server/db-assigned (id, dateAdded, createdAt...) or comes from an
// integration the app doesn't drive (IGDB/Steam/PSN linking, HLTB).
export interface GameInput {
  title: string;
  platform: string;
  region?: string | null;
  condition?: string | null;
  format?: Format;
  notes?: string | null;
  personalRating?: number | null;
  playStatus?: PlayStatus;
  wishlist?: boolean;
  playlist?: boolean;
  datePurchased?: string | null;
  purchasePriceGbp?: number | null;
  valueLooseGbp?: number | null;
  valueCibGbp?: number | null;
  valueNewGbp?: number | null;
  coverUrl?: string | null;
}

export type GamePatch = Partial<GameInput>;
