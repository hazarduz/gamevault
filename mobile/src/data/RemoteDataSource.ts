import { DataSource, DataSourceError } from "@/data/DataSource";
import { Game, GameInput, GamePatch } from "@/types/game";

// Talks to an existing GameVault server (app/api/* in the main repo).
// Auth is Bearer-token, not the browser's httpOnly cookie — see
// lib/session.ts on the server for the matching fallback. The token is
// captured once from POST /api/auth/login and handed in by AppModeContext.
export class RemoteDataSource implements DataSource {
  constructor(private baseUrl: string, private token: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
          ...init?.headers,
        },
      });
    } catch {
      throw new DataSourceError(
        `Couldn't reach ${this.baseUrl}. Check the server URL and that the device has network access to it.`
      );
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // non-JSON error body; keep the generic message
      }
      throw new DataSourceError(message, res.status);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  listCollection(query?: { q?: string }): Promise<Game[]> {
    const qs = query?.q ? `?q=${encodeURIComponent(query.q)}` : "";
    return this.request<Game[]>(`/api/games${qs}`);
  }

  listWishlist(): Promise<Game[]> {
    return this.request<Game[]>(`/api/wishlist`);
  }

  getGame(id: string): Promise<Game> {
    return this.request<Game>(`/api/games/${id}`);
  }

  createGame(input: GameInput): Promise<Game> {
    return this.request<Game>(`/api/games`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateGame(id: string, patch: GamePatch): Promise<Game> {
    return this.request<Game>(`/api/games/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  async deleteGame(id: string): Promise<void> {
    await this.request<void>(`/api/games/${id}`, { method: "DELETE" });
  }
}

// Called from the "Connect to a server" screen, before a RemoteDataSource
// exists — it has no token yet, so it's a plain function rather than a
// DataSource method.
export async function loginToServer(
  baseUrl: string,
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new DataSourceError(
      `Couldn't reach ${baseUrl}. Double-check the URL (including https://) and that the server is reachable from this device.`
    );
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new DataSourceError(body?.error ?? `Login failed (${res.status})`, res.status);
  }
  if (!body?.token) {
    throw new DataSourceError(
      "Server responded but didn't return a token — is this a GameVault server new enough to support the mobile app?"
    );
  }
  return { token: body.token, username: body.username ?? username };
}
