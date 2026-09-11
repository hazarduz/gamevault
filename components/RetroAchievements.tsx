"use client";

// RetroAchievements sync, its own section in Settings (unlike Steam
// achievements, this doesn't share credentials with anything else — the
// username + Web API key here are RA-specific). Two independent actions:
//  - "Find RetroAchievements matches" resolves each unlinked game's
//    platform to an RA console and searches that console's game list —
//    only platforms RA actually covers (classic/retro consoles) turn up
//    anything; modern platforms are silently skipped.
//  - "Sync achievements" refreshes every already-linked game.

import { useState } from "react";

interface RaMatch {
  id: number;
  title: string;
  iconUrl: string | null;
  exact: boolean;
}

interface Proposal {
  gameId: string;
  title: string;
  platform: string;
  matches: RaMatch[];
}

interface ScanResult {
  proposals: Proposal[];
  noConsole: number;
}

export default function RetroAchievements({
  enabled,
  username,
  hasApiKey,
  onToggle,
  onSaveUsername,
  onSaveApiKey,
}: {
  enabled: boolean;
  username: string;
  hasApiKey: boolean;
  onToggle: (v: boolean) => void;
  onSaveUsername: (v: string) => void;
  onSaveApiKey: (v: string) => void;
}) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [choices, setChoices] = useState<Record<string, number | "">>({});

  const canRun = enabled && !!username && hasApiKey;

  async function findMatches() {
    setBusy(true);
    setMsg(null);
    setScan(null);
    try {
      const res = await fetch("/api/retroachievements/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed.");
      const result = data as ScanResult;
      setScan(result);
      const seeded: Record<string, number | ""> = {};
      for (const p of result.proposals) {
        seeded[p.gameId] = p.matches.find((m) => m.exact)?.id ?? "";
      }
      setChoices(seeded);
      setMsg(
        result.proposals.length === 0
          ? "No RetroAchievements matches found for anything unlinked."
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
      .map((p) => ({ gameId: p.gameId, raGameId: choices[p.gameId] as number }));
    if (links.length === 0) {
      setMsg("Nothing selected to link.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/retroachievements/apply", {
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
      const res = await fetch("/api/retroachievements/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setMsg(
        data.synced === 0 && data.remaining === 0
          ? "No games to sync yet — link some above first."
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
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-parchment">RetroAchievements</h2>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      <p className="mt-1 text-sm text-mute">
        Covers classic/retro consoles — SNES, NES, PS1, Game Boy, and dozens
        more. Games on platforms RetroAchievements doesn&rsquo;t track (most
        modern ones) are simply skipped.
      </p>
      <p className="mt-2 text-xs text-mute">
        Web API key: sign in at retroachievements.org, then open{" "}
        <a
          className="text-amber underline"
          href="https://retroachievements.org/settings"
          target="_blank"
          rel="noopener noreferrer"
        >
          retroachievements.org/settings
        </a>{" "}
        and copy your key from the Keys tab.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className="label">RA Username</label>
          <input
            className="field"
            defaultValue={username}
            onBlur={(e) => onSaveUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="label">
            Web API key {hasApiKey && <span className="text-xs text-mute">(currently set)</span>}
          </label>
          <input
            type="password"
            className="field"
            placeholder={hasApiKey ? "••••••••" : ""}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onBlur={() => {
              if (apiKeyInput) {
                onSaveApiKey(apiKeyInput);
                setApiKeyInput("");
              }
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={findMatches}
          disabled={busy || !canRun}
          className="btn-secondary text-xs"
        >
          {busy ? "Working…" : "Find RetroAchievements matches"}
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
                  <option key={m.id} value={m.id}>
                    {m.title}
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

// Mirrors the unexported Toggle in app/settings/page.tsx — kept local
// since that one isn't shared, and this is the only other place needing it.
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 rounded-full transition ${checked ? "bg-amber" : "bg-ink-line"}`}
    >
      <span
        className={`block h-5 w-5 translate-x-0.5 rounded-full bg-ink transition ${
          checked ? "translate-x-[22px] bg-ink" : ""
        }`}
      />
    </button>
  );
}
