import { Game, GameInput, GamePatch } from "@/types/game";

// One interface, two backends: RemoteDataSource talks to a hosted
// GameVault server's REST API; LocalDataSource keeps everything in an
// on-device SQLite file. Every screen in the app is written against this
// interface only, so switching mode never touches screen code.
export interface DataSource {
  listCollection(query?: { q?: string }): Promise<Game[]>;
  listWishlist(): Promise<Game[]>;
  getGame(id: string): Promise<Game>;
  createGame(input: GameInput): Promise<Game>;
  updateGame(id: string, patch: GamePatch): Promise<Game>;
  deleteGame(id: string): Promise<void>;
}

export class DataSourceError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "DataSourceError";
  }
}
