"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";

interface Release {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string;
  platforms: string[];
  hypes: number;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
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

export default function CalendarView({
  releases,
  ownedPlatforms,
  existingIgdbIds,
}: {
  releases: Release[];
  ownedPlatforms: string[];
  existingIgdbIds: number[];
}) {
  const existing = useMemo(() => new Set(existingIgdbIds), [existingIgdbIds]);

  // Every platform that appears in the feed.
  const allPlatforms = useMemo(() => {
    const s = new Set<string>();
    for (const r of releases) for (const p of r.platforms) s.add(p);
    return [...s].sort();
  }, [releases]);

  // Default the filter to the platforms the user owns (that also appear
  // in the feed); if that's empty, show everything.
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(() => {
    const owned = new Set(ownedPlatforms.map((p) => p.toLowerCase()));
    const match = allPlatforms.filter((p) =>
      [...owned].some(
        (o) => o.includes(p.toLowerCase()) || p.toLowerCase().includes(o)
      )
    );
    return new Set(match.length > 0 ? match : allPlatforms);
  });

  const [monthOffset, setMonthOffset] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [choice, setChoice] = useState<Record<number, string>>({});
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const view = new Date();
  view.setDate(1);
  view.setMonth(view.getMonth() + monthOffset);
  const viewKey = monthKey(view);

  const monthReleases = useMemo(() => {
    return releases
      .filter((r) => {
        const d = new Date(r.releaseDate);
        return (
          monthKey(d) === viewKey &&
          r.platforms.some((p) => activePlatforms.has(p))
        );
      })
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  }, [releases, viewKey, activePlatforms]);

  // Group by calendar day.
  const groups = useMemo(() => {
    const m = new Map<string, Release[]>();
    for (const r of monthReleases) {
      const key = r.releaseDate.slice(0, 10);
      const arr = m.get(key);
      if (arr) arr.push(r);
      else m.set(key, [r]);
    }
    return [...m.entries()];
  }, [monthReleases]);

  function togglePlatform(p: string) {
    setActivePlatforms((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function wishlist(r: Release) {
    const platform = choice[r.igdbId] ?? defaultPlatform(r.platforms);
    setBusyId(r.igdbId);
    setMsg(null);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igdbId: r.igdbId, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't wishlist that.");
      setAdded((s) => new Set(s).add(r.igdbId));
      setMsg(`Added "${r.title}" (${platform}) to your wishlist.`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthOffset((n) => n - 1)}
          className="btn-secondary text-xs"
          disabled={monthOffset <= 0}
        >
          ‹ Prev
        </button>
        <span className="font-display text-lg font-bold text-parchment">
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setMonthOffset((n) => n + 1)}
          className="btn-secondary text-xs"
        >
          Next ›
        </button>
      </div>

      {allPlatforms.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {allPlatforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                activePlatforms.has(p)
                  ? "border-amber bg-amber/15 text-parchment"
                  : "border-ink-line text-mute hover:border-mute"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {msg && <p className="mt-4 text-sm text-amber">{msg}</p>}

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-mute">
          No releases this month for the selected platforms.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map(([day, items]) => (
            <div key={day}>
              <h3 className="mb-2 font-display text-sm font-bold text-mute">
                {new Date(day).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              <div className="space-y-2">
                {items.map((r) => {
                  const owned = existing.has(r.igdbId);
                  const done = added.has(r.igdbId);
                  const open = openId === r.igdbId;
                  return (
                    <div
                      key={r.igdbId}
                      className="rounded-card border border-ink-line bg-ink-soft"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.igdbId)}
                        className="flex w-full items-center gap-3 p-2 text-left"
                      >
                        <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-ink-softer">
                          {r.coverUrl && (
                            <Image src={r.coverUrl} alt={r.title} fill className="object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-parchment">{r.title}</p>
                          <p className="truncate text-xs text-mute">
                            {r.platforms.join(", ") || "Platform TBA"}
                          </p>
                        </div>
                        {(owned || done) && (
                          <span className="shrink-0 text-xs text-mute">
                            {done ? "Added ✓" : "In GameVault"}
                          </span>
                        )}
                      </button>

                      {open && !owned && !done && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-ink-line p-2">
                          <select
                            className="field w-auto flex-1 text-xs"
                            value={choice[r.igdbId] ?? defaultPlatform(r.platforms)}
                            onChange={(e) =>
                              setChoice((c) => ({ ...c, [r.igdbId]: e.target.value }))
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
                            onClick={() => wishlist(r)}
                            disabled={busyId === r.igdbId}
                            className="btn-primary text-xs"
                          >
                            {busyId === r.igdbId ? "Adding…" : "Wishlist"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
