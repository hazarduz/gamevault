"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";
import { PICKER_PLATFORMS, PICKER_GENRES, PICKER_LENGTHS } from "@/lib/picker-filters";

interface PickerGame {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  summary: string | null;
  genres: string[];
  releaseDate: string | null;
  developer: string | null;
  publisher: string | null;
  rating: number | null;
  platforms: string[];
  trailerYoutubeId: string | null;
  screenshots: string[];
}

interface Hltb {
  mainHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
}

function defaultPlatform(platforms: string[]): string {
  const p = pickPreferredPlatform(platforms);
  return (PLATFORM_OPTIONS as readonly string[]).includes(p) ? p : PLATFORM_OPTIONS[0];
}

export default function GamePicker() {
  const [game, setGame] = useState<PickerGame | null>(null);
  const [ownedGameId, setOwnedGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noneReason, setNoneReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hltb, setHltb] = useState<Hltb | null>(null);
  const [hltbLoading, setHltbLoading] = useState(false);

  // Filters
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [filterLength, setFilterLength] = useState("");

  const [addPlatform, setAddPlatform] = useState<string>(PLATFORM_OPTIONS[0]);
  const [busy, setBusy] = useState<"wishlist" | "playlist" | null>(null);
  const [done, setDone] = useState<"wishlist" | "playlist" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Bumped each pick so a slow HLTB response from a previous roll can't
  // land on the current game.
  const rollId = useRef(0);

  const pick = useCallback(async () => {
    const myRoll = ++rollId.current;
    setLoading(true);
    setError(null);
    setNoneReason(null);
    setMsg(null);
    setDone(null);
    setHltb(null);
    try {
      const qs = new URLSearchParams();
      if (filterPlatform) qs.set("platform", filterPlatform);
      if (filterGenre) qs.set("genre", filterGenre);
      if (filterLength) qs.set("length", filterLength);
      const res = await fetch(`/api/picker${qs.toString() ? `?${qs}` : ""}`);
      const json = await res.json();
      if (rollId.current !== myRoll) return;
      if (!res.ok) throw new Error(json.error ?? "Couldn't pick a game.");
      if (!json.game) {
        setGame(null);
        setNoneReason(json.reason ?? "The roll came up empty — try again.");
        return;
      }
      setGame(json.game);
      setOwnedGameId(json.ownedGameId ?? null);
      setAddPlatform(defaultPlatform(json.game.platforms));

      if (json.hltb) {
        // Length filter was used — the route already looked HLTB up.
        setHltb(json.hltb);
      } else {
        setHltbLoading(true);
        fetch(`/api/hltb?q=${encodeURIComponent(json.game.title)}`)
          .then((r) => r.json())
          .then((d) => {
            if (rollId.current === myRoll) setHltb(d.result ?? null);
          })
          .catch(() => {
            if (rollId.current === myRoll) setHltb(null);
          })
          .finally(() => {
            if (rollId.current === myRoll) setHltbLoading(false);
          });
      }
    } catch (e: any) {
      if (rollId.current === myRoll) setError(e.message);
    } finally {
      if (rollId.current === myRoll) setLoading(false);
    }
  }, [filterPlatform, filterGenre, filterLength]);

  useEffect(() => {
    pick();
  }, [pick]);

  async function addWishlist() {
    if (!game) return;
    setBusy("wishlist");
    setMsg(null);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igdbId: game.igdbId, platform: addPlatform, wishlist: true }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "Couldn't add that.");
      setDone("wishlist");
      setMsg(`Added "${game.title}" (${addPlatform}) to your wishlist.`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function addPlaylist() {
    if (!game) return;
    setBusy("playlist");
    setMsg(null);
    try {
      const res = ownedGameId
        ? await fetch(`/api/games/${ownedGameId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playlist: true }),
          })
        : await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ igdbId: game.igdbId, platform: addPlatform, playlist: true }),
          });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "Couldn't add that.");
      setDone("playlist");
      setMsg(`Added "${game.title}" to your play list.`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  const year = game?.releaseDate ? new Date(game.releaseDate).getUTCFullYear() : null;
  const owned = !!ownedGameId;

  const hltbText = (() => {
    if (hltbLoading) return "HowLongToBeat: loading times…";
    if (!hltb) return "HowLongToBeat: no data";
    const parts: string[] = [];
    if (hltb.mainHours != null) parts.push(`Main ${hltb.mainHours}h`);
    if (hltb.mainExtraHours != null) parts.push(`Main + extra ${hltb.mainExtraHours}h`);
    if (hltb.completionistHours != null) parts.push(`Completionist ${hltb.completionistHours}h`);
    return parts.length ? `HowLongToBeat: ${parts.join(" · ")}` : "HowLongToBeat: no data";
  })();

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <Filter label="Platform" value={filterPlatform} onChange={setFilterPlatform}>
          <option value="">All platforms</option>
          {PICKER_PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Filter>
        <Filter label="Genre" value={filterGenre} onChange={setFilterGenre}>
          <option value="">All genres</option>
          {PICKER_GENRES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </Filter>
        <Filter label="Length" value={filterLength} onChange={setFilterLength}>
          <option value="">Any length</option>
          {PICKER_LENGTHS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Filter>
        <button type="button" onClick={pick} disabled={loading} className="btn-secondary text-sm">
          {loading ? "Rolling…" : "↻ Re-pick"}
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-mute">
          {filterLength ? "Finding a game in that time range…" : "Picking a game…"}
        </p>
      ) : error ? (
        <p className="mt-6 rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : !game ? (
        <p className="mt-6 text-sm text-mute">{noneReason}</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Left: details + actions */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-5 rounded-card border border-ink-line bg-ink-soft p-4 sm:flex-row">
              <div className="relative aspect-[3/4] w-full flex-shrink-0 overflow-hidden rounded-card border border-ink-line bg-ink-softer sm:w-44">
                {game.coverUrl && (
                  <Image src={game.coverUrl} alt={game.title} fill className="object-cover" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-display text-xl font-bold text-parchment">{game.title}</h2>
                  {game.rating != null && (
                    <span className="text-sm text-amber">{game.rating}/100</span>
                  )}
                  {year && <span className="text-sm text-mute">{year}</span>}
                </div>

                {game.genres.length > 0 && (
                  <p className="mt-1 text-xs text-mute">{game.genres.join(" · ")}</p>
                )}
                {(game.developer || game.publisher) && (
                  <p className="mt-0.5 text-xs text-mute">
                    {[
                      game.developer,
                      game.publisher && game.publisher !== game.developer ? game.publisher : null,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                )}

                {owned && (
                  <p className="mt-2 text-xs text-teal">
                    You already own this (unplayed) —{" "}
                    <Link href={`/games/${ownedGameId}`} className="underline">
                      open it
                    </Link>
                    .
                  </p>
                )}

                {game.summary && (
                  <p className="mt-3 text-sm leading-relaxed text-parchment/90">{game.summary}</p>
                )}

                <p className="mt-3 text-xs text-mute">{hltbText}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!owned && (
                <>
                  <label className="text-xs text-mute">
                    Add as{" "}
                    <select
                      className="field ml-1 w-40 text-xs"
                      value={addPlatform}
                      onChange={(e) => setAddPlatform(e.target.value)}
                    >
                      {PLATFORM_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={addWishlist}
                    disabled={busy !== null || done === "wishlist"}
                    className="btn-secondary text-sm"
                  >
                    {busy === "wishlist"
                      ? "Adding…"
                      : done === "wishlist"
                      ? "Wishlisted ✓"
                      : "Add to wishlist"}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={addPlaylist}
                disabled={busy !== null || done === "playlist"}
                className="btn-primary text-sm"
              >
                {busy === "playlist"
                  ? "Adding…"
                  : done === "playlist"
                  ? "On play list ✓"
                  : "Add to my play list"}
              </button>
            </div>

            {msg && <p className="text-sm text-amber">{msg}</p>}
          </div>

          {/* Right: trailer + screenshots */}
          <div className="flex flex-col gap-4">
            {game.trailerYoutubeId && (
              <div className="aspect-video w-full overflow-hidden rounded-card border border-ink-line bg-black">
                <iframe
                  key={game.trailerYoutubeId}
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${game.trailerYoutubeId}`}
                  title={`${game.title} trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {game.screenshots.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {game.screenshots.map((src) => (
                  // Plain <img>: variable-length gallery from images.igdb.com
                  // (already an allowed host for the covers).
                  <img
                    key={src}
                    src={src}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full rounded border border-ink-line object-cover"
                  />
                ))}
              </div>
            )}

            {!game.trailerYoutubeId && game.screenshots.length === 0 && (
              <p className="text-xs text-mute">No trailer or screenshots for this one.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-mute">
      {label}
      <select
        className="field text-xs sm:w-44"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
