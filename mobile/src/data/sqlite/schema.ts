import * as SQLite from "expo-sqlite";
import { Game } from "@/types/game";

export const DB_NAME = "gamevault.db";

export function openDb(): SQLite.SQLiteDatabase {
  const db = SQLite.openDatabaseSync(DB_NAME);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      region TEXT,
      condition TEXT,
      format TEXT NOT NULL DEFAULT 'Physical',
      notes TEXT,
      personalRating INTEGER,
      playStatus TEXT NOT NULL DEFAULT 'unplayed',
      wishlist INTEGER NOT NULL DEFAULT 0,
      playlist INTEGER NOT NULL DEFAULT 0,
      dateAdded TEXT NOT NULL,
      datePurchased TEXT,
      purchasePriceGbp REAL,
      valueLooseGbp REAL,
      valueCibGbp REAL,
      valueNewGbp REAL,
      valueUpdatedAt TEXT,
      valueSource TEXT,
      coverUrl TEXT,
      releaseDate TEXT,
      summary TEXT,
      genres TEXT NOT NULL DEFAULT '[]',
      developer TEXT,
      publisher TEXT,
      aggregatedRating REAL,
      metacriticScore INTEGER,
      hltbMainHours REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  return db;
}

// SQLite has no boolean or JSON-array type; store 0/1 and a JSON string
// and translate at the edge so the rest of the app only ever sees a Game.
export type GameRow = Omit<Game, "wishlist" | "playlist" | "genres"> & {
  wishlist: number;
  playlist: number;
  genres: string;
};

export function rowToGame(row: GameRow): Game {
  let genres: string[] = [];
  try {
    genres = JSON.parse(row.genres);
  } catch {
    genres = [];
  }
  return {
    ...row,
    wishlist: row.wishlist === 1,
    playlist: row.playlist === 1,
    genres,
  };
}

export function genId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
