"use client";

// Steam achievements, embedded in the Settings page next to Steam
// library import (shares the same Steam ID field — this component
// doesn't duplicate it). Two independent actions:
//  - "Find Steam matches" searches Steam's app list for every collection
//    game that isn't linked yet, on any platform — this is how a PS4/PS5
//    game gets cross-referenced to its Steam release.
//  - "Sync achievements" refreshes every already-linked game, and
//    auto-links (no search needed) anything pulled in via Steam library
//    import.

import { useState } from "react";

interface SteamAppMatch {
  appid: number;
  name: string;
  exact: boolean;
}

interface Proposal {
  gameId: string;
  title: string;
  platform: string;
  matches: SteamAppMatch[];
}

interface ScanResult {
  proposals: Proposal[];
  autoLinkable: number;
}

export default function SteamAchievements({
  hasSteamId,
  available,
}: {
  hasSteamId: boolean;
  available: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [choices, setChoices] = useState<Record<string, number | "">>({});

  const canRun = available && hasSteamId;

  async function findMatches() {
    setBusy(true);
    setMsg(null);
    setScan(null);
    try {
      const res = await fetch("/api/steam/achievements/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed.");
      const result = data as ScanResult;
      setScan(result);
      const seeded: Record<string, number | ""> = {};
      for (const p of result.proposals) {
        seeded[p.gameId] = p.matches.find((m) => m.exact)?.appid ?? "";
      }
      setChoices(seeded);
      setMsg(
        result.proposals.length === 0
          ? "No Steam matches found for anything unlinked."
          : `Found possible matches for ${result.proposals.length} game${
              result.proposals.length === 1 ? "" : "s"
            }. Review below, then Link & sync.`
      );
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyMatches() {
    if (!scan) return;
    const links = scan.proposals
      .filter((p) => choices[p.gameId] !== "" && choices[p.gameId] != null)
      .map((p) => ({ gameId: p.gameId, appId: choices[p.gameId] as number }));
    if (links.length === 0) {
      setMsg("Nothing selected to link.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/steam/achievements/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed.");
      setScan(null);
      setChoices({});
      setMsg(
        `Linked and synced ${data.linked} game${data.linked === 1 ? "" : "s"}` +
          (data.errors?.length ? `. ${data.errors.length} failed — try those again later.` : ".")
      );
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncAll() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/steam/achievements/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setMsg(
        data.synced === 0 && data.remaining === 0
          ? "No games to sync yet — link some above, or import from your Steam library first."
          : `Synced ${data.synced} game${data.synced === 1 ? "" : "s"}` +
              (data.remaining ? `. ${data.remaining} left — press again to continue.` : ".") +
              (data.errors?.length ? ` ${data.errors.length} failed.` : "")
      );
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-ink-line bg-ink-soft p-5">
      <h2 className="font-display text-lg font-bold text-parchment">Steam achievements</h2>
      <p className="mt-1 text-sm text-mute">
        Achievement lists come straight from Steam and don&rsquo;t need play
        history, so this works for any game — including a PS4/PS5 game,
        cross-linked to its Steam release, as a reference list. Your own
        progress only shows if this Steam account has actually played it
        there.
      </p>
      {!available && (
        <p className="mt-2 text-xs text-amber">
          Needs Steam import enabled and a Steam Web API key — see Steam import
          below.
        </p>
      )}
      {available && !hasSteamId && (
        <p className="mt-2 text-xs text-amber">
          Set your Steam ID above in Steam library import first.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={findMatches}
          disabled={busy || !canRun}
          className="btn-secondary text-xs"
        >
          {busy ? "Working…" : "Find Steam matches"}
        </button>
        <button
          type="button"
          onClick={syncAll}
          disabled={busy || !canRun}
          className="btn-secondary text-xs"
        >
          {busy ? "Working…" : "Sync achievements"}
        </button>
        {msg && <span className="text-xs text-amber">{msg}</span>}
      </div>

      {scan && scan.proposals.length > 0 && (
        <div className="mt-4 space-y-2">
          {scan.autoLinkable > 0 && (
            <p className="text-xs text-mute">
              {scan.autoLinkable} Steam-imported game{scan.autoLinkable === 1 ? "" : "s"} will
              link automatically when you press &ldquo;Sync achievements&rdquo; — no
              search needed.
            </p>
          )}
          {scan.proposals.map((p) => (
            <div
              key={p.gameId}
              className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1fr] sm:items-center sm:gap-3"
            >
              <span className="text-sm text-parchment">
                {p.title}
                <span className="text-xs text-mute"> · {p.platform}</span>
              </span>
              <select
                className="field"
                value={choices[p.gameId] ?? ""}
                onChange={(e) =>
                  setChoices((c) => ({
                    ...c,
                    [p.gameId]: e.target.value ? Number(e.target.value) : "",
                  }))
                }
              >
                <option value="">— skip —</option>
                {p.matches.map((m) => (
                  <option key={m.appid} value={m.appid}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="pt-2">
            <button type="button" onClick={applyMatches} disabled={busy} className="btn-primary text-xs">
              Link &amp; sync selected
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
