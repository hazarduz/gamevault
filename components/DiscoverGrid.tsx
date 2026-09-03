"use client";

import { useState } from "react";
import Image from "next/image";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";

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
      {msg && <p className="mb-4 text-sm text-amber">{msg}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((s) => {
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
