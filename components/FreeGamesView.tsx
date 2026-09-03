"use client";

// Renders the Currently Free feed. The server page passes the cached
// result in; this component shows "updated N ago", soft-refreshes on an
// interval and on window focus (the server respects the cache TTL, so
// those are cheap), and has a "Refresh now" button that forces an
// upstream re-fetch via /api/free-games/refresh.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FreeGame, FreeGamesResult, FreeStore } from "@/lib/free-games";

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STORE_CLASS: Record<FreeStore, string> = {
  Steam: "text-sky-300",
  "Epic Games": "text-parchment",
  GOG: "text-purple-300",
  "itch.io": "text-pink-300",
  Xbox: "text-green-400",
  PlayStation: "text-blue-300",
  Nintendo: "text-red-400",
  "Amazon Prime": "text-cyan-300",
  Other: "text-mute",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "recently";
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function endLabel(game: FreeGame): string | null {
  if (game.status === "upcoming") {
    if (!game.startsAt) return "Coming soon";
    const d = new Date(game.startsAt);
    if (Number.isNaN(d.getTime())) return "Coming soon";
    return `Free from ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  }
  if (!game.endsAt) return null;
  const end = Date.parse(game.endsAt);
  if (!Number.isFinite(end)) return null;
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days <= 0) return "Ending soon";
  if (days === 1) return "Ends tomorrow";
  if (days <= 7) return `Ends in ${days} days`;
  return `Ends ${new Date(end).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export default function FreeGamesView({
  initial,
  error,
  owned,
}: {
  initial: FreeGamesResult | null;
  error: string | null;
  owned: Record<string, "owned" | "wishlist">;
}) {
  const router = useRouter();
  const [result, setResult] = useState<FreeGamesResult | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Re-sync when the server component re-renders (soft refresh).
  useEffect(() => {
    setResult(initial);
  }, [initial]);

  // Soft refresh: re-run the server component (cache TTL still applies).
  useEffect(() => {
    const tick = () => router.refresh();
    const id = setInterval(tick, 20 * 60_000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [router]);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/free-games/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed.");
      setResult(data as FreeGamesResult);
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [router]);

  if (error && !result) {
    return (
      <p className="mt-6 rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-sm text-red-400">
        {error}
      </p>
    );
  }
  if (!result) {
    return <p className="mt-6 text-sm text-mute">Loading…</p>;
  }

  const live = result.items.filter((g) => g.status === "live");
  const upcoming = result.items.filter((g) => g.status === "upcoming");

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
        <span>
          {result.items.length} offer{result.items.length === 1 ? "" : "s"} · updated{" "}
          {relativeTime(result.fetchedAt)}
        </span>
        <button
          type="button"
          onClick={refreshNow}
          disabled={refreshing}
          className="btn-secondary px-2.5 py-1 text-xs"
        >
          {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
        {msg && <span className="text-red-400">{msg}</span>}
      </div>

      {result.stale && (
        <p className="mb-4 rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-xs text-amber">
          Couldn&rsquo;t reach the sources just now — showing the last good list.
        </p>
      )}
      {result.sourceErrors.length > 0 && !result.stale && (
        <p className="mb-4 text-xs text-mute">
          {result.sourceErrors.map((e) => e.source).join(" and ")} unavailable —
          the list may be incomplete.
        </p>
      )}

      {result.items.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-line py-16 text-center text-sm text-mute">
          Nothing free right now. Check back later.
        </p>
      ) : (
        <>
          <Section title="Live now" games={live} owned={owned} />
          {upcoming.length > 0 && (
            <Section title="Coming soon" games={upcoming} owned={owned} />
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  games,
  owned,
}: {
  title: string;
  games: FreeGame[];
  owned: Record<string, "owned" | "wishlist">;
}) {
  if (games.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-mute">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <Card key={g.id} game={g} have={owned[normalizeTitle(g.title)]} />
        ))}
      </div>
    </section>
  );
}

function Card({
  game,
  have,
}: {
  game: FreeGame;
  have: "owned" | "wishlist" | undefined;
}) {
  const ends = endLabel(game);
  return (
    <a
      href={game.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-card border border-ink-line bg-ink-soft transition hover:border-mute"
    >
      <div className="relative aspect-[16/9] w-full bg-ink-softer">
        {game.imageUrl ? (
          // Plain <img>, not next/image: the feed's image hosts vary and
          // aren't worth maintaining in next.config's remotePatterns.
          <img
            src={game.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center font-display text-sm text-mute">
            {game.title}
          </div>
        )}
        {have && (
          <span className="absolute right-2 top-2 rounded-full bg-ink/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-parchment ring-1 ring-ink-line">
            {have === "owned" ? "In collection" : "Wishlisted"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`font-display font-bold ${STORE_CLASS[game.store]}`}>
            {game.store}
          </span>
          {game.type !== "game" && (
            <span className="rounded bg-ink-softer px-1.5 py-0.5 uppercase tracking-wide text-mute">
              {game.type}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-display text-sm font-medium leading-snug text-parchment">
          {game.title}
        </h3>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs">
          <span className="text-mute">
            {game.worth ? (
              <>
                <span className="text-amber">Free</span>{" "}
                <span className="line-through">was {game.worth}</span>
              </>
            ) : (
              <span className="text-amber">Free</span>
            )}
          </span>
          {ends && <span className="shrink-0 text-mute">{ends}</span>}
        </div>
      </div>
    </a>
  );
}
