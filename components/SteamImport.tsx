"use client";

// Steam library import, embedded in the Settings page. Same shape as the
// photo importer (app/games/import): a server scan returns bare titles,
// the browser matches each against IGDB with a progress line, you confirm
// the rows, and they go in through /api/games/import. Steam rows carry
// their appid (for re-scan dedupe) and import as Digital.

import { useState } from "react";
import Image from "next/image";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";

interface IgdbHit {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  platforms: string[];
}

interface SteamGame {
  steamAppId: number;
  name: string;
  playtimeMinutes: number;
}

interface Row {
  steamAppId: number;
  name: string;
  playtimeMinutes: number;
  matches: IgdbHit[];
  matchIdx: number; // -1 = "add as typed, no IGDB"
  platform: string;
  include: boolean;
  searching: boolean;
}

const IMPORT_CHUNK = 100;

async function searchIgdb(query: string): Promise<IgdbHit[]> {
  try {
    const res = await fetch(`/api/igdb/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 6) : [];
  } catch {
    return [];
  }
}

// Steam is a PC storefront, so default to PC; fall back to IGDB's
// platform list only if "PC" somehow isn't offered.
function defaultPlatform(match: IgdbHit | undefined): string {
  if ((PLATFORM_OPTIONS as readonly string[]).includes("PC")) return "PC";
  if (match?.platforms?.length) {
    const p = pickPreferredPlatform(match.platforms);
    if ((PLATFORM_OPTIONS as readonly string[]).includes(p)) return p;
  }
  return PLATFORM_OPTIONS[0];
}

function formatPlaytime(minutes: number): string {
  if (!minutes) return "unplayed";
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`;
}

export default function SteamImport({
  initialSteamId,
  available,
}: {
  initialSteamId: string;
  available: boolean;
}) {
  const [steamId, setSteamId] = useState(initialSteamId);
  const [savedId, setSavedId] = useState(initialSteamId);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);

  async function saveSteamId(value: string) {
    const next = value.trim();
    if (next === savedId) return;
    try {
      const res = await fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId: next }),
      });
      const data = await res.json();
      setSavedId(data.steamId ?? "");
      setSteamId(data.steamId ?? "");
      setMsg("Steam ID saved.");
    } catch {
      setMsg("Couldn't save the Steam ID.");
    }
  }

  async function scan() {
    setBusy(true);
    setMsg(null);
    setDone(null);
    setRows([]);
    setProgress("Reading your Steam library…");
    try {
      const res = await fetch("/api/steam/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed.");

      const games: SteamGame[] = data.games ?? [];
      if (games.length === 0) {
        setProgress(null);
        setMsg(
          data.total > 0
            ? `All ${data.total} games in that library are already imported.`
            : "No games found on that Steam account."
        );
        return;
      }

      const out: Row[] = [];
      for (let i = 0; i < games.length; i += 4) {
        setProgress(`Matching ${Math.min(i + 4, games.length)} of ${games.length} against IGDB…`);
        const batch = games.slice(i, i + 4);
        const results = await Promise.all(batch.map((g) => searchIgdb(g.name)));
        batch.forEach((g, j) => {
          const matches = results[j];
          out.push({
            steamAppId: g.steamAppId,
            name: g.name,
            playtimeMinutes: g.playtimeMinutes,
            matches,
            matchIdx: matches.length > 0 ? 0 : -1,
            platform: defaultPlatform(matches[0]),
            include: true,
            searching: false,
          });
        });
      }
      setRows(out);
      setProgress(null);
      setMsg(
        `${out.length} game${out.length === 1 ? "" : "s"} to review` +
          (data.skipped ? `, ${data.skipped} already imported` : "") +
          ". Untick anything you don't want, then add."
      );
    } catch (e: any) {
      setProgress(null);
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  function patch(appId: number, next: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.steamAppId === appId ? { ...r, ...next } : r)));
  }

  async function research(r: Row) {
    patch(r.steamAppId, { searching: true });
    const matches = await searchIgdb(r.name);
    patch(r.steamAppId, {
      matches,
      matchIdx: matches.length > 0 ? 0 : -1,
      platform: defaultPlatform(matches[0]),
      searching: false,
    });
  }

  async function addAll() {
    const games = rows
      .filter((r) => r.include)
      .map((r) => {
        const m = r.matchIdx >= 0 ? r.matches[r.matchIdx] : undefined;
        return {
          igdbId: m?.igdbId,
          title: (m?.title ?? r.name).trim(),
          platform: r.platform,
          format: "Digital" as const,
          steamAppId: r.steamAppId,
        };
      })
      .filter((g) => g.title && g.platform);

    if (games.length === 0) {
      setMsg("Nothing ticked to add.");
      return;
    }

    setAdding(true);
    setMsg(null);
    try {
      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < games.length; i += IMPORT_CHUNK) {
        const res = await fetch("/api/games/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ games: games.slice(i, i + IMPORT_CHUNK) }),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error ?? "Import failed.");
        imported += r.imported ?? 0;
        skipped += r.skipped ?? 0;
      }
      setDone({ imported, skipped });
      setRows([]);
      setMsg(null);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setAdding(false);
    }
  }

  const includeCount = rows.filter((r) => r.include).length;

  return (
    <section className="rounded-card border border-ink-line bg-ink-soft p-5">
      <h2 className="font-display text-lg font-bold text-parchment">Steam library import</h2>
      <p className="mt-1 text-sm text-mute">
        Pulls your owned Steam games in, matched against IGDB for art and
        metadata. They&rsquo;re added as <span className="text-parchment">Digital</span> on{" "}
        <span className="text-parchment">PC</span>. Your Steam profile&rsquo;s
        &ldquo;Game details&rdquo; privacy must be set to Public.
      </p>

      {!available && (
        <p className="mt-3 text-xs text-amber">
          The site admin needs to add a Steam Web API key (and enable Steam
          import) in Site administration below before this can run.
        </p>
      )}

      <div className="mt-4">
        <label className="label">SteamID64, vanity name, or profile URL</label>
        <input
          className="field"
          value={steamId}
          placeholder="76561198… or steamcommunity.com/id/yourname"
          onChange={(e) => setSteamId(e.target.value)}
          onBlur={(e) => saveSteamId(e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={scan}
          disabled={busy || adding || !available || !savedId}
          className="btn-secondary text-xs"
        >
          {busy ? "Working…" : "Scan library"}
        </button>
        {progress && <span className="text-xs text-amber">{progress}</span>}
        {msg && !progress && <span className="text-xs text-amber">{msg}</span>}
      </div>

      {done && (
        <p className="mt-3 text-sm text-parchment">
          Added {done.imported} game{done.imported === 1 ? "" : "s"}
          {done.skipped ? `, skipped ${done.skipped} already in your collection` : ""}.
          Reload to see them.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-mute">
              {rows.length} found · {includeCount} ticked
            </p>
            <button
              type="button"
              onClick={addAll}
              disabled={adding || includeCount === 0}
              className="btn-primary text-xs"
            >
              {adding ? "Adding…" : `Add ${includeCount} game${includeCount === 1 ? "" : "s"}`}
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((r) => {
              const m = r.matchIdx >= 0 ? r.matches[r.matchIdx] : undefined;
              return (
                <div
                  key={r.steamAppId}
                  className={`rounded-card border border-ink-line bg-ink p-2 ${
                    r.include ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => patch(r.steamAppId, { include: e.target.checked })}
                      className="mt-1.5 accent-amber"
                    />
                    <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-ink-softer">
                      {m?.coverUrl && (
                        <Image src={m.coverUrl} alt="" fill className="object-cover" />
                      )}
                    </div>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr_8rem]">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-parchment">{r.name}</p>
                        <p className="text-[10px] text-mute">
                          {formatPlaytime(r.playtimeMinutes)} played
                        </p>
                        <button
                          type="button"
                          onClick={() => research(r)}
                          disabled={r.searching}
                          className="mt-1 text-[10px] text-amber hover:underline disabled:opacity-50"
                        >
                          {r.searching ? "searching…" : "re-search IGDB"}
                        </button>
                      </div>
                      <select
                        className="field text-xs"
                        value={r.matchIdx}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          patch(r.steamAppId, {
                            matchIdx: idx,
                            platform: defaultPlatform(idx >= 0 ? r.matches[idx] : undefined),
                          });
                        }}
                      >
                        {r.matches.map((mm, i) => (
                          <option key={mm.igdbId} value={i}>
                            {mm.title}
                            {mm.releaseDate ? ` (${mm.releaseDate.slice(0, 4)})` : ""}
                          </option>
                        ))}
                        <option value={-1}>Add as typed — no IGDB</option>
                      </select>
                      <select
                        className="field text-xs"
                        value={r.platform}
                        onChange={(e) => patch(r.steamAppId, { platform: e.target.value })}
                      >
                        {PLATFORM_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setRows((rs) => rs.filter((x) => x.steamAppId !== r.steamAppId))
                      }
                      className="mt-1 text-mute transition hover:text-red-400"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
