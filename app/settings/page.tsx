"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SCORE_BANDS, type ScoreBand } from "@/lib/score-badge";
import {
  DEFAULT_STATUS_COLORS,
  PLAY_STATUS_OPTIONS,
  type PlayStatus,
} from "@/lib/play-status";
import StatusMark from "@/components/StatusMark";
import SteamImport from "@/components/SteamImport";

interface Prefs {
  scoreBadgeEnabled: boolean;
  scoreBadgeBands: ScoreBand[];
  statusBadgeEnabled: boolean;
  statusColors: Record<PlayStatus, string>;
  dimCompleted: boolean;
  dimPlayedPreviously: boolean;
  dimStrength: number;
  psnEnabled: boolean;
  psnOnlineId: string;
  hasPsnNpsso: boolean;
  steamId: string;
}

interface Instance {
  isAdmin: boolean;
  igdbEnabled: boolean;
  twitchClientId: string;
  hasTwitchClientSecret: boolean;
  hltbEnabled: boolean;
  steamImportEnabled: boolean;
  hasSteamApiKey: boolean;
  priceChartingEnabled: boolean;
  currencyApiUrl: string;
  barcodeLookupEnabled: boolean;
  barcodeApiUrl: string;
}

interface PsnScan {
  proposals: { psnName: string; psnPlatform: string; suggestedGameId: string | null }[];
  games: { id: string; title: string; platform: string }[];
  platinumCount: number;
}

interface UserRow {
  id: string;
  username: string;
  role: string;
  pending: boolean;
  inviteToken: string | null;
  inviteExpired: boolean;
}

export default function SettingsPage() {
  const router = useRouter();

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [twitchSecretInput, setTwitchSecretInput] = useState("");
  const [steamKeyInput, setSteamKeyInput] = useState("");
  const [psnNpssoInput, setPsnNpssoInput] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountMsg, setAccountMsg] = useState<string | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);

  const [psnBusy, setPsnBusy] = useState(false);
  const [psnMsg, setPsnMsg] = useState<string | null>(null);
  const [psnScan, setPsnScan] = useState<PsnScan | null>(null);
  const [psnChoices, setPsnChoices] = useState<Record<string, string>>({});

  // Local editable copies, re-synced whenever prefs change.
  const [bands, setBands] = useState<ScoreBand[]>([]);
  const [statusColors, setStatusColors] = useState<Record<PlayStatus, string>>(
    DEFAULT_STATUS_COLORS
  );
  const [dimStrength, setDimStrength] = useState(70);

  // Users (admin only)
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [usersMsg, setUsersMsg] = useState<string | null>(null);

  // Backup & restore
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [instImportFile, setInstImportFile] = useState<File | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prefs").then((r) => r.json()).then(setPrefs);
    fetch("/api/settings").then((r) => r.json()).then(setInstance);
  }, []);

  useEffect(() => {
    if (prefs) {
      setBands(prefs.scoreBadgeBands);
      setStatusColors(prefs.statusColors);
      setDimStrength(prefs.dimStrength);
    }
  }, [prefs]);

  useEffect(() => {
    if (instance?.isAdmin) loadUsers();
  }, [instance?.isAdmin]);

  async function savePrefs(
    patch: Partial<Prefs> & { psnNpsso?: string }
  ) {
    setStatusMsg(null);
    const res = await fetch("/api/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setPrefs(await res.json());
    setPsnNpssoInput("");
    setStatusMsg("Saved.");
  }

  async function saveInstance(
    patch: Partial<Instance> & { twitchClientSecret?: string; steamApiKey?: string }
  ) {
    setStatusMsg(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.error) {
      setStatusMsg(data.error);
      return;
    }
    setInstance(data);
    setTwitchSecretInput("");
    setSteamKeyInput("");
    setStatusMsg("Saved.");
  }

  function updateBand(i: number, patch: Partial<ScoreBand>) {
    setBands((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function removeBand(i: number) {
    setBands((bs) => bs.filter((_, idx) => idx !== i));
  }
  function addBand() {
    setBands((bs) => [...bs, { min: 0, max: 100, bg: "#000000", fg: "#ffffff" }]);
  }
  function resetBands() {
    setBands(DEFAULT_SCORE_BANDS);
    savePrefs({ scoreBadgeBands: DEFAULT_SCORE_BANDS });
  }
  function updateStatusColor(key: PlayStatus, hex: string) {
    setStatusColors((c) => ({ ...c, [key]: hex }));
  }
  function resetStatusColors() {
    setStatusColors(DEFAULT_STATUS_COLORS);
    savePrefs({ statusColors: DEFAULT_STATUS_COLORS });
  }

  async function scanPsn() {
    setPsnBusy(true);
    setPsnMsg(null);
    setPsnScan(null);
    try {
      const res = await fetch("/api/psn/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      const scan = data as PsnScan;
      setPsnScan(scan);
      const seeded: Record<string, string> = {};
      for (const p of scan.proposals) {
        seeded[`${p.psnName}|${p.psnPlatform}`] = p.suggestedGameId ?? "";
      }
      setPsnChoices(seeded);
      setPsnMsg(
        scan.platinumCount === 0
          ? "No earned platinums found on that account."
          : `Found ${scan.platinumCount} platinum${scan.platinumCount === 1 ? "" : "s"}. Review the matches, then Apply.`
      );
    } catch (e: any) {
      setPsnMsg(e.message);
    } finally {
      setPsnBusy(false);
    }
  }

  async function applyPsn() {
    const gameIds = Array.from(new Set(Object.values(psnChoices).filter(Boolean)));
    if (gameIds.length === 0) {
      setPsnMsg("Nothing selected to apply.");
      return;
    }
    setPsnBusy(true);
    setPsnMsg(null);
    try {
      const res = await fetch("/api/psn/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setPsnScan(null);
      setPsnChoices({});
      setPsnMsg(`Updated ${data.updated} game${data.updated === 1 ? "" : "s"} to Platinum Achieved.`);
    } catch (e: any) {
      setPsnMsg(e.message);
    } finally {
      setPsnBusy(false);
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }
  async function inviteUser() {
    const username = newUserName.trim();
    if (!username) return;
    setUsersMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      setUsersMsg(data.error ?? "Couldn't create the invite.");
      return;
    }
    setNewUserName("");
    await loadUsers();
    await copyLink(data.inviteUrl);
    setUsersMsg(`Invite link for "${username}" copied to the clipboard.`);
  }
  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this invite link:", url);
    }
  }
  async function regenInvite(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH" });
    const data = await res.json();
    if (res.ok) {
      await copyLink(data.inviteUrl);
      setUsersMsg("New invite link copied to the clipboard.");
      await loadUsers();
    } else {
      setUsersMsg(data.error ?? "Couldn't regenerate the link.");
    }
  }
  async function deleteUser(u: UserRow) {
    if (!confirm(`Delete "${u.username}" and all their games?`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsersMsg(`Deleted "${u.username}".`);
      await loadUsers();
    } else {
      const data = await res.json();
      setUsersMsg(data.error ?? "Couldn't delete that user.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountMsg(null);
    setAccountSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAccountMsg("Account updated.");
      setCurrentPassword("");
      setNewUsername("");
      setNewPassword("");
    } catch (e: any) {
      setAccountMsg(e.message);
    } finally {
      setAccountSaving(false);
    }
  }

  async function runImport() {
    if (!importFile) return;
    if (
      importMode === "replace" &&
      !confirm("Replace deletes ALL your current games first, then imports. Continue?")
    )
      return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await importFile.text());
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: importMode, data }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "Import failed.");
      setBackupMsg(
        `Imported ${r.imported} game${r.imported === 1 ? "" : "s"}` +
          (r.skipped ? `, skipped ${r.skipped} already present.` : ".") +
          " Reload to see them."
      );
      fetch("/api/prefs").then((x) => x.json()).then(setPrefs);
    } catch (e: any) {
      setBackupMsg(e.message);
    } finally {
      setBackupBusy(false);
    }
  }

  async function runInstanceRestore() {
    if (!instImportFile) return;
    if (
      !confirm(
        "This wipes EVERY account, all their games, and the instance settings, then restores from the file. Everyone is logged out. Continue?"
      )
    )
      return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await instImportFile.text());
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "Restore failed.");
      setBackupMsg(`Restored ${r.users} account(s) and ${r.games} game(s). Signing you out…`);
      setTimeout(() => window.location.assign("/login"), 1200);
    } catch (e: any) {
      setBackupMsg(e.message);
      setBackupBusy(false);
    }
  }

  if (!prefs || !instance) return <p className="text-mute">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-parchment">Settings</h1>
        <p className="mt-1 text-sm text-mute">
          Your display preferences and account.
          {instance.isAdmin && " Integration credentials are shared across the site."}
        </p>
      </div>

      {statusMsg && <p className="text-sm text-amber">{statusMsg}</p>}

      {/* --- Score badges (per-user) --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">Score badges</h2>
          <Toggle
            checked={prefs.scoreBadgeEnabled}
            onChange={(v) => savePrefs({ scoreBadgeEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          The circle on each cover shows that game&rsquo;s IGDB score. Pick the
          circle and text colour for each range.
        </p>

        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[2.25rem_1fr_1fr_auto_auto_1.5rem] items-center gap-2 text-xs text-mute">
            <span />
            <span>Min</span>
            <span>Max</span>
            <span>Circle</span>
            <span>Text</span>
            <span />
          </div>
          {bands.map((band, i) => (
            <div
              key={i}
              className="grid grid-cols-[2.25rem_1fr_1fr_auto_auto_1.5rem] items-center gap-2"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-bold ring-1 ring-black/20"
                style={{ backgroundColor: band.bg, color: band.fg }}
              >
                {band.max}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                className="field"
                value={band.min}
                onChange={(e) => updateBand(i, { min: clampScore(parseInt(e.target.value, 10)) })}
              />
              <input
                type="number"
                min={0}
                max={100}
                className="field"
                value={band.max}
                onChange={(e) => updateBand(i, { max: clampScore(parseInt(e.target.value, 10)) })}
              />
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-ink-line bg-ink-soft"
                value={band.bg}
                onChange={(e) => updateBand(i, { bg: e.target.value })}
              />
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-ink-line bg-ink-soft"
                value={band.fg}
                onChange={(e) => updateBand(i, { fg: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeBand(i)}
                className="text-mute transition hover:text-red-400"
                aria-label="Remove band"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={addBand} className="btn-secondary text-xs">
            + Add band
          </button>
          <button
            type="button"
            onClick={() => savePrefs({ scoreBadgeBands: bands })}
            className="btn-primary text-xs"
          >
            Save badge colours
          </button>
          <button type="button" onClick={resetBands} className="btn-secondary text-xs">
            Reset to defaults
          </button>
        </div>
      </section>

      {/* --- Play status (per-user) --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">Play status</h2>
          <Toggle
            checked={prefs.statusBadgeEnabled}
            onChange={(v) => savePrefs({ statusBadgeEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          The dot on the bottom-left of each cover shows your progress. Set each
          dot&rsquo;s colour below.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-parchment">Dim completed &amp; platinum covers</span>
          <Toggle
            checked={prefs.dimCompleted}
            onChange={(v) => savePrefs({ dimCompleted: v })}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-parchment">Dim &ldquo;Played previously&rdquo; covers</span>
          <Toggle
            checked={prefs.dimPlayedPreviously}
            onChange={(v) => savePrefs({ dimPlayedPreviously: v })}
          />
        </div>

        <div
          className={`mt-3 ${
            prefs.dimCompleted || prefs.dimPlayedPreviously ? "" : "opacity-40"
          }`}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-mute">Dim strength</span>
            <span className="tabular-nums text-parchment">{dimStrength}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={95}
            step={5}
            value={dimStrength}
            disabled={!prefs.dimCompleted && !prefs.dimPlayedPreviously}
            onChange={(e) => setDimStrength(Number(e.target.value))}
            onPointerUp={(e) => savePrefs({ dimStrength: Number(e.currentTarget.value) })}
            onKeyUp={(e) => savePrefs({ dimStrength: Number(e.currentTarget.value) })}
            className="mt-1 w-full accent-amber"
          />
        </div>

        <div className="mt-4 space-y-2">
          {PLAY_STATUS_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center">
                <StatusMark status={opt.value} colors={statusColors} idSuffix={`set-${opt.value}`} />
              </span>
              <span className="flex-1 text-sm text-parchment">{opt.label}</span>
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-ink-line bg-ink-soft"
                value={statusColors[opt.value]}
                onChange={(e) => updateStatusColor(opt.value, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => savePrefs({ statusColors })}
            className="btn-primary text-xs"
          >
            Save status colours
          </button>
          <button type="button" onClick={resetStatusColors} className="btn-secondary text-xs">
            Reset to defaults
          </button>
        </div>
      </section>

      {/* --- PlayStation trophies (per-user) --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">PlayStation trophies</h2>
          <Toggle
            checked={prefs.psnEnabled}
            onChange={(v) => savePrefs({ psnEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          Reads your PlayStation trophy progress and lets you mark games where
          you&rsquo;ve earned the platinum as{" "}
          <span className="text-parchment">Platinum Achieved</span>.
        </p>
        <p className="mt-2 text-xs text-mute">
          Token: sign in at playstation.com, then open{" "}
          <a
            className="text-amber underline"
            href="https://ca.account.sony.com/api/v1/ssocookie"
            target="_blank"
            rel="noopener noreferrer"
          >
            ca.account.sony.com/api/v1/ssocookie
          </a>{" "}
          and copy the <code>npsso</code> value. It lasts about two months.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="label">PSN Online ID</label>
            <input
              className="field"
              defaultValue={prefs.psnOnlineId}
              onBlur={(e) => savePrefs({ psnOnlineId: e.target.value })}
            />
          </div>
          <div>
            <label className="label">
              NPSSO token{" "}
              {prefs.hasPsnNpsso && <span className="text-xs text-mute">(currently set)</span>}
            </label>
            <input
              type="password"
              className="field"
              placeholder={prefs.hasPsnNpsso ? "••••••••" : ""}
              value={psnNpssoInput}
              onChange={(e) => setPsnNpssoInput(e.target.value)}
              onBlur={() => psnNpssoInput && savePrefs({ psnNpsso: psnNpssoInput })}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={scanPsn}
            disabled={psnBusy || !prefs.psnEnabled}
            className="btn-secondary text-xs"
          >
            {psnBusy ? "Working…" : "Scan for platinums"}
          </button>
          {psnMsg && <span className="text-xs text-amber">{psnMsg}</span>}
        </div>

        {psnScan && psnScan.proposals.length > 0 && (
          <div className="mt-4 space-y-2">
            {psnScan.proposals.map((p) => {
              const rowKey = `${p.psnName}|${p.psnPlatform}`;
              return (
                <div
                  key={rowKey}
                  className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1fr] sm:items-center sm:gap-3"
                >
                  <span className="text-sm text-parchment">
                    {p.psnName}
                    <span className="text-xs text-mute"> · {p.psnPlatform}</span>
                  </span>
                  <select
                    className="field"
                    value={psnChoices[rowKey] ?? ""}
                    onChange={(e) => setPsnChoices((c) => ({ ...c, [rowKey]: e.target.value }))}
                  >
                    <option value="">— skip —</option>
                    {psnScan.games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title} — {g.platform}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            <div className="pt-2">
              <button type="button" onClick={applyPsn} disabled={psnBusy} className="btn-primary text-xs">
                Apply selected
              </button>
            </div>
          </div>
        )}
      </section>

      {/* --- Steam library import (per-user) --- */}
      <SteamImport
        initialSteamId={prefs.steamId}
        available={instance.steamImportEnabled && instance.hasSteamApiKey}
      />

      {/* --- Account --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <h2 className="font-display text-lg font-bold text-parchment">Account</h2>
        <form onSubmit={handleAccountSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              required
              className="field"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">New username (optional)</label>
              <input
                className="field"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="label">New password (optional)</label>
              <input
                type="password"
                className="field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          {accountMsg && <p className="text-sm text-amber">{accountMsg}</p>}
          <button type="submit" disabled={accountSaving} className="btn-primary">
            {accountSaving ? "Saving…" : "Update account"}
          </button>
        </form>
        <button onClick={handleLogout} className="btn-secondary mt-4 w-full">
          Log out
        </button>
      </section>

      {/* --- Backup & restore (per-user) --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <h2 className="font-display text-lg font-bold text-parchment">Backup &amp; restore</h2>
        <p className="mt-1 text-sm text-mute">
          Download every game in your account plus your display preferences
          (including your PSN token) as a JSON file, or restore from one.
        </p>

        <div className="mt-4">
          <a href="/api/backup" download className="btn-secondary inline-block text-xs">
            Download my backup
          </a>
        </div>

        <div className="mt-5 space-y-2">
          <label className="label">Restore from a file</label>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-mute file:mr-3 file:rounded file:border file:border-ink-line file:bg-ink file:px-2 file:py-1 file:text-parchment"
          />
          <div className="flex flex-wrap gap-4 pt-1 text-xs text-parchment">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="importmode"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
                className="accent-amber"
              />
              Merge — add games that aren&rsquo;t already here
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="importmode"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
                className="accent-amber"
              />
              Replace — wipe my games first
            </label>
          </div>
          <button
            type="button"
            onClick={runImport}
            disabled={!importFile || backupBusy}
            className="btn-primary text-xs"
          >
            {backupBusy ? "Working…" : "Import"}
          </button>
          {backupMsg && <p className="text-xs text-amber">{backupMsg}</p>}
        </div>
      </section>

      {instance.isAdmin && (
        <>
          <div className="pt-2">
            <h2 className="font-display text-lg font-bold text-amber">
              Site administration
            </h2>
            <p className="mt-1 text-sm text-mute">
              These apply to everyone on this GameVault.
            </p>
          </div>

          {/* --- Users --- */}
          <section className="rounded-card border border-ink-line bg-ink-soft p-5">
            <h2 className="font-display text-lg font-bold text-parchment">Users</h2>
            <p className="mt-1 text-sm text-mute">
              Create an account, then send the person their invite link to set a
              password. Each user has a completely separate collection.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                className="field flex-1"
                placeholder="New username"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
              <button type="button" onClick={inviteUser} className="btn-primary text-xs">
                Create &amp; copy invite link
              </button>
            </div>
            {usersMsg && <p className="mt-2 text-xs text-amber">{usersMsg}</p>}

            <div className="mt-4 space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center gap-2 border-t border-ink-line pt-2 text-sm"
                >
                  <span className="flex-1 text-parchment">
                    {u.username}
                    {u.role === "admin" && (
                      <span className="ml-2 text-xs text-amber">admin</span>
                    )}
                    {u.pending && (
                      <span className="ml-2 text-xs text-mute">
                        {u.inviteExpired ? "invite expired" : "invite pending"}
                      </span>
                    )}
                  </span>
                  {u.pending && (
                    <button
                      type="button"
                      onClick={() => regenInvite(u.id)}
                      className="btn-secondary text-xs"
                    >
                      {u.inviteExpired ? "New link" : "Copy link"}
                    </button>
                  )}
                  {u.role !== "admin" && (
                    <button
                      type="button"
                      onClick={() => deleteUser(u)}
                      className="btn-secondary text-xs text-red-400"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* --- Full instance backup --- */}
          <section className="rounded-card border border-ink-line bg-ink-soft p-5">
            <h2 className="font-display text-lg font-bold text-parchment">
              Full instance backup
            </h2>
            <p className="mt-1 text-sm text-mute">
              Everything: every account (with password hashes and PSN tokens),
              all their games, and the integration settings. For disaster
              recovery — restoring wipes the instance and logs everyone out.
            </p>

            <div className="mt-4">
              <a
                href="/api/admin/backup"
                download
                className="btn-secondary inline-block text-xs"
              >
                Download instance backup
              </a>
            </div>

            <div className="mt-5 space-y-2">
              <label className="label">Restore the whole instance</label>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => setInstImportFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-mute file:mr-3 file:rounded file:border file:border-ink-line file:bg-ink file:px-2 file:py-1 file:text-parchment"
              />
              <button
                type="button"
                onClick={runInstanceRestore}
                disabled={!instImportFile || backupBusy}
                className="btn-primary text-xs text-red-400"
              >
                {backupBusy ? "Working…" : "Wipe & restore instance"}
              </button>
            </div>
          </section>

          {/* --- IGDB --- */}
          <section className="rounded-card border border-ink-line bg-ink-soft p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-parchment">IGDB metadata</h2>
              <Toggle
                checked={instance.igdbEnabled}
                onChange={(v) => saveInstance({ igdbEnabled: v })}
              />
            </div>
            <p className="mt-1 text-sm text-mute">
              Cover art, release dates, summaries, genres, Discover, the calendar.
              Requires free Twitch developer credentials.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="label">Twitch Client ID</label>
                <input
                  className="field"
                  defaultValue={instance.twitchClientId}
                  onBlur={(e) => saveInstance({ twitchClientId: e.target.value })}
                />
              </div>
              <div>
                <label className="label">
                  Twitch Client Secret{" "}
                  {instance.hasTwitchClientSecret && (
                    <span className="text-xs text-mute">(currently set)</span>
                  )}
                </label>
                <input
                  type="password"
                  className="field"
                  placeholder={instance.hasTwitchClientSecret ? "••••••••" : ""}
                  value={twitchSecretInput}
                  onChange={(e) => setTwitchSecretInput(e.target.value)}
                  onBlur={() =>
                    twitchSecretInput && saveInstance({ twitchClientSecret: twitchSecretInput })
                  }
                />
              </div>
            </div>
          </section>

          {/* --- HowLongToBeat --- */}
          <section className="rounded-card border border-ink-line bg-ink-soft p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-parchment">HowLongToBeat</h2>
              <Toggle
                checked={instance.hltbEnabled}
                onChange={(v) => saveInstance({ hltbEnabled: v })}
              />
            </div>
            <p className="mt-1 text-sm text-mute">
              Completion time estimates. Unofficial endpoint, no credentials needed.
            </p>
          </section>

          {/* --- Steam --- */}
          <section className="rounded-card border border-ink-line bg-ink-soft p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-parchment">Steam import</h2>
              <Toggle
                checked={instance.steamImportEnabled}
                onChange={(v) => saveInstance({ steamImportEnabled: v })}
              />
            </div>
            <p className="mt-1 text-sm text-mute">
              Lets each user pull in their owned Steam games from their personal
              settings. One Steam Web API key covers the whole instance — get a
              free one at{" "}
              <a
                className="text-amber underline"
                href="https://steamcommunity.com/dev/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                steamcommunity.com/dev/apikey
              </a>
              .
            </p>
            <div className="mt-4">
              <label className="label">
                Steam Web API key{" "}
                {instance.hasSteamApiKey && (
                  <span className="text-xs text-mute">(currently set)</span>
                )}
              </label>
              <input
                type="password"
                className="field"
                placeholder={instance.hasSteamApiKey ? "••••••••" : ""}
                value={steamKeyInput}
                onChange={(e) => setSteamKeyInput(e.target.value)}
                onBlur={() => steamKeyInput && saveInstance({ steamApiKey: steamKeyInput })}
              />
            </div>
          </section>

          {/* --- PriceCharting --- */}
          <section className="rounded-card border border-ink-line bg-ink-soft p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-parchment">PriceCharting</h2>
              <Toggle
                checked={instance.priceChartingEnabled}
                onChange={(v) => saveInstance({ priceChartingEnabled: v })}
              />
            </div>
            <p className="mt-1 text-sm text-mute">
              Current resale values, converted from USD to GBP.
            </p>
            <div className="mt-4">
              <label className="label">Currency conversion API URL</label>
              <input
                className="field"
                defaultValue={instance.currencyApiUrl}
                placeholder="https://open.er-api.com/v6/latest/USD"
                onBlur={(e) => saveInstance({ currencyApiUrl: e.target.value })}
              />
            </div>
          </section>

          {/* --- Barcode lookup --- */}
          <section className="rounded-card border border-ink-line bg-ink-soft p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-parchment">Barcode lookup</h2>
              <Toggle
                checked={instance.barcodeLookupEnabled}
                onChange={(v) => saveInstance({ barcodeLookupEnabled: v })}
              />
            </div>
            <p className="mt-1 text-sm text-mute">
              Powers the &ldquo;Scan barcode&rdquo; button on the Add a game
              screen. Default is UPCitemdb&rsquo;s free tier.
            </p>
            <div className="mt-4">
              <label className="label">
                Barcode API URL{" "}
                <span className="text-xs text-mute">
                  (barcode appended, or use a {"{code}"} placeholder)
                </span>
              </label>
              <input
                className="field"
                defaultValue={instance.barcodeApiUrl}
                placeholder="https://api.upcitemdb.com/prod/trial/lookup?upc="
                onBlur={(e) => saveInstance({ barcodeApiUrl: e.target.value })}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

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
