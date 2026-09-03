"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";

const PAGE_SIZE = 24;

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Suggestion {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseYear: number | null;
  rating: number | null;
  summary: string | null;
  platforms: string[];
  count: number;
}

function defaultPlatform(platforms: string[]): string {
  const guess = pickPreferredPlatform(platforms);
  if ((PLATFORM_OPTIONS as readonly string[]).includes(guess)) return guess;
  const fuzzy = PLATFORM_OPTIONS.find((o) =>
    platforms.some(
      (p) =>
        o.toLowerCase().includes(p.toLowerCase()) ||
        p.toLowerCase().includes(o.toLowerCase())
    )
  );
  return fuzzy ?? PLATFORM_OPTIONS[0];
}

export default function DiscoverGrid({ suggestions }: { suggestions: Suggestion[] }) {
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Rotate through the full pool a page at a time, reshuffling on wrap.
  const [order, setOrder] = useState<number[]>(() => shuffled(suggestions.length));
  const [start, setStart] = useState(0);
  const canRotate = suggestions.length > PAGE_SIZE;

  function rotate() {
    const next = start + PAGE_SIZE;
    if (next >= order.length) {
      setOrder(shuffled(suggestions.length));
      setStart(0);
    } else {
      setStart(next);
    }
  }

  const visible = useMemo(
    () =>
      order
        .slice(start, start + PAGE_SIZE)
        .map((i) => suggestions[i])
        .filter((s): s is Suggestion => !!s && !added.has(s.igdbId)),
    [order, start, suggestions, added]
  );

  async function addGame(s: Suggestion, asWishlist: boolean) {
    const platform = choice[s.igdbId] ?? defaultPlatform(s.platforms);
    setBusyId(s.igdbId);
    setMsg(null);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igdbId: s.igdbId, platform, wishlist: asWishlist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that game.");
      setAdded((prev) => new Set(prev).add(s.igdbId));
      setMsg(
        `Added "${s.title}" (${platform}) to your ${
          asWishlist ? "wishlist" : "collection"
        }.`
      );
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mute">
          Showing {visible.length} of {suggestions.length}
        </p>
        {canRotate && (
          <button type="button" onClick={rotate} className="btn-secondary text-xs">
            ↻ Rotate
          </button>
        )}
      </div>
      {msg && <p className="mb-4 text-sm text-amber">{msg}</p>}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {visible.map((s) => {
          const done = added.has(s.igdbId);
          return (
            <div
              key={s.igdbId}
              className={`flex gap-3 rounded-card border border-ink-line bg-ink-soft p-3 transition ${
                done ? "opacity-40" : ""
              }`}
            >
              <div className="relative h-32 w-24 flex-shrink-0 overflow-hidden rounded bg-ink-softer">
                {s.coverUrl && (
                  <Image src={s.coverUrl} alt={s.title} fill className="object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="font-display text-sm font-medium text-parchment">
                  {s.title}
                </p>
                <p className="text-xs text-mute">
                  {s.releaseYear ?? "—"}
                  {s.rating !== null && ` · ${s.rating}/100`}
                  {` · in ${s.count} of your games`}
                </p>
                {s.summary && (
                  <p className="mt-1 line-clamp-3 text-xs text-parchment/80">
                    {s.summary}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  {done ? (
                    <span className="text-xs text-mute">Added ✓</span>
                  ) : (
                    <>
                      <select
                        className="field w-full text-xs"
                        value={choice[s.igdbId] ?? defaultPlatform(s.platforms)}
                        onChange={(e) =>
                          setChoice((c) => ({ ...c, [s.igdbId]: e.target.value }))
                        }
                      >
                        {PLATFORM_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addGame(s, true)}
                        disabled={busyId === s.igdbId}
                        className="btn-primary text-xs"
                      >
                        {busyId === s.igdbId ? "…" : "Wishlist"}
                      </button>
                      <button
                        type="button"
                        onClick={() => addGame(s, false)}
                        disabled={busyId === s.igdbId}
                        className="btn-secondary text-xs"
                      >
                        {busyId === s.igdbId ? "…" : "Add to collection"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
