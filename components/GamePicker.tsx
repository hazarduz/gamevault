"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";

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
  const [noneFound, setNoneFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hltb, setHltb] = useState<Hltb | null>(null);
  const [hltbLoading, setHltbLoading] = useState(false);

  const [platform, setPlatform] = useState(PLATFORM_OPTIONS[0]);
  const [busy, setBusy] = useState<"wishlist" | "playlist" | null>(null);
  const [done, setDone] = useState<"wishlist" | "playlist" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Bumped on every pick so a slow HLTB response from a previous roll
  // can't land on the current game.
  const rollId = useRef(0);

  const pick = useCallback(async () => {
    const myRoll = ++rollId.current;
    setLoading(true);
    setError(null);
    setNoneFound(false);
    setMsg(null);
    setDone(null);
    setHltb(null);
    try {
      const res = await fetch("/api/picker");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't pick a game.");
      if (!json.game) {
        setGame(null);
        setNoneFound(true);
        return;
      }
      setGame(json.game);
      setOwnedGameId(json.ownedGameId ?? null);
      setPlatform(defaultPlatform(json.game.platforms));

      // Times fill in a moment later so the pick itself renders fast.
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
        body: JSON.stringify({ igdbId: game.igdbId, platform, wishlist: true }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "Couldn't add that.");
      setDone("wishlist");
      setMsg(`Added "${game.title}" (${platform}) to your wishlist.`);
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
            body: JSON.stringify({ igdbId: game.igdbId, platform, playlist: true }),
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

  if (loading) {
    return <p className="mt-8 text-sm text-mute">Picking a game…</p>;
  }
  if (error) {
    return (
      <div className="mt-8">
        <p className="rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-sm text-red-400">
          {error}
        </p>
        <button type="button" onClick={pick} className="btn-secondary mt-3 text-xs">
          Try again
        </button>
      </div>
    );
  }
  if (noneFound || !game) {
    return (
      <div className="mt-8">
        <p className="text-sm text-mute">
          Couldn&rsquo;t find one that fits right now — everything the roll turned up
          is already played or wishlisted. Try again.
        </p>
        <button type="button" onClick={pick} className="btn-secondary mt-3 text-xs">
          Re-pick
        </button>
      </div>
    );
  }

  const year = game.releaseDate ? new Date(game.releaseDate).getUTCFullYear() : null;
  const owned = !!ownedGameId;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-5 rounded-card border border-ink-line bg-ink-soft p-4 sm:flex-row">
        <div className="relative aspect-[3/4] w-full flex-shrink-0 overflow-hidden rounded-card border border-ink-line bg-ink-softer sm:w-44">
          {game.coverUrl && <Image src={game.coverUrl} alt={game.title} fill className="object-cover" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display text-xl font-bold text-parchment">{game.title}</h2>
            {game.rating != null && <span className="text-sm text-amber">{game.rating}/100</span>}
            {year && <span className="text-sm text-mute">{year}</span>}
          </div>

          {game.genres.length > 0 && (
            <p className="mt-1 text-xs text-mute">{game.genres.join(" · ")}</p>
          )}
          {(game.developer || game.publisher) && (
            <p className="mt-0.5 text-xs text-mute">
              {[game.developer, game.publisher && game.publisher !== game.developer ? game.publisher : null]
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
            <p className="mt-3 line-clamp-6 text-sm leading-relaxed text-parchment/90">
              {game.summary}
            </p>
          )}

          <p className="mt-3 text-xs text-mute">
            {hltbLoading ? (
              "HowLongToBeat: loading times…"
            ) : hltb && (hltb.mainHours || hltb.mainExtraHours || hltb.completionistHours) ? (
              <>
                HowLongToBeat:{" "}
                {hltb.mainHours != null && <>Main {hltb.mainHours}h</>}
                {hltb.mainExtraHours != null && <> · Main + extra {hltb.mainExtraHours}h</>}
                {hltb.completionistHours != null && <> · Completionist {hltb.completionistHours}h</>}
              </>
            ) : (
              "HowLongToBeat: no data"
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={pick} className="btn-secondary text-sm">
          ↻ Re-pick
        </button>

        {!owned && (
          <>
            <label className="text-xs text-mute">
              Platform{" "}
              <select
                className="field ml-1 w-40 text-xs"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
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

      {msg && <p className="mt-2 text-sm text-amber">{msg}</p>}
    </div>
  );
}
