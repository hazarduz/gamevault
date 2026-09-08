import { DataSource, DataSourceError } from "@/data/DataSource";
import { Game, GameInput, GamePatch } from "@/types/game";
import { genId, GameRow, openDb, rowToGame } from "@/data/sqlite/schema";

// Every field a GameInput/GamePatch can carry, and how to turn its JS
// value into something SQLite can store. Booleans and the genres array
// need translating; everything else passes through as-is.
const BOOLEAN_COLUMNS = new Set(["wishlist", "playlist"]);

function toColumnValue(key: string, value: unknown): unknown {
  if (key === "genres") return JSON.stringify(value ?? []);
  if (BOOLEAN_COLUMNS.has(key)) return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}

export class LocalDataSource implements DataSource {
  private db = openDb();

  private queryGames(where: string, params: unknown[] = []): Game[] {
    const rows = this.db.getAllSync<GameRow>(
      `SELECT * FROM games WHERE ${where} ORDER BY title COLLATE NOCASE ASC`,
      params as any[]
    );
    return rows.map(rowToGame);
  }

  async listCollection(query?: { q?: string }): Promise<Game[]> {
    if (query?.q) {
      return this.queryGames("wishlist = 0 AND title LIKE ?", [`%${query.q}%`]);
    }
    return this.queryGames("wishlist = 0");
  }

  async listWishlist(): Promise<Game[]> {
    return this.queryGames("wishlist = 1");
  }

  async getGame(id: string): Promise<Game> {
    const row = this.db.getFirstSync<GameRow>(`SELECT * FROM games WHERE id = ?`, [id]);
    if (!row) throw new DataSourceError("That game no longer exists.", 404);
    return rowToGame(row);
  }

  async createGame(input: GameInput): Promise<Game> {
    const now = new Date().toISOString();
    const id = genId();
    const full: Record<string, unknown> = {
      id,
      title: input.title,
      platform: input.platform,
      region: input.region ?? null,
      condition: input.condition ?? null,
      format: input.format ?? "Physical",
      notes: input.notes ?? null,
      personalRating: input.personalRating ?? null,
      playStatus: input.playStatus ?? "unplayed",
      wishlist: input.wishlist ?? false,
      playlist: input.playlist ?? false,
      dateAdded: now,
      datePurchased: input.datePurchased ?? null,
      purchasePriceGbp: input.purchasePriceGbp ?? null,
      valueLooseGbp: input.valueLooseGbp ?? null,
      valueCibGbp: input.valueCibGbp ?? null,
      valueNewGbp: input.valueNewGbp ?? null,
      coverUrl: input.coverUrl ?? null,
      genres: [],
      createdAt: now,
      updatedAt: now,
    };

    const columns = Object.keys(full);
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((c) => toColumnValue(c, full[c]));

    this.db.runSync(
      `INSERT INTO games (${columns.join(", ")}) VALUES (${placeholders})`,
      values as any[]
    );
    return this.getGame(id);
  }

  async updateGame(id: string, patch: GamePatch): Promise<Game> {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.getGame(id);

    const setClause = entries.map(([k]) => `${k} = ?`).join(", ");
    const values = entries.map(([k, v]) => toColumnValue(k, v));

    this.db.runSync(
      `UPDATE games SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, new Date().toISOString(), id] as any[]
    );
    return this.getGame(id);
  }

  async deleteGame(id: string): Promise<void> {
    this.db.runSync(`DELETE FROM games WHERE id = ?`, [id]);
  }

  // Used by Settings' Export/Import backup — not part of the shared
  // DataSource interface since RemoteDataSource has no equivalent (the
  // hosted server has its own /api/backup for that).
  exportAll(): Game[] {
    return this.queryGames("1 = 1");
  }

  importAll(games: Game[]): void {
    for (const g of games) {
      const exists = this.db.getFirstSync<{ id: string }>(`SELECT id FROM games WHERE id = ?`, [
        g.id,
      ]);
      if (exists) continue; // don't clobber existing rows on re-import
      const columns = Object.keys(g).filter((k) => k !== "trophies" && k !== "achievements");
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((c) => toColumnValue(c, (g as unknown as Record<string, unknown>)[c]));
      this.db.runSync(
        `INSERT INTO games (${columns.join(", ")}) VALUES (${placeholders})`,
        values as any[]
      );
    }
  }
}
