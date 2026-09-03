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

interface SettingsShape {
  igdbEnabled: boolean;
  twitchClientId: string;
  hasTwitchClientSecret: boolean;
  hltbEnabled: boolean;
  priceChartingEnabled: boolean;
  currencyApiUrl: string;
  scoreBadgeEnabled: boolean;
  scoreBadgeBands: ScoreBand[];
  barcodeLookupEnabled: boolean;
  barcodeApiUrl: string;
  statusBadgeEnabled: boolean;
  statusColors: Record<PlayStatus, string>;
  dimCompleted: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [twitchClientSecretInput, setTwitchClientSecretInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountMsg, setAccountMsg] = useState<string | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);

  // Local working copies, re-synced whenever settings change (including
  // right after a save, so the saved value wins).
  const [bands, setBands] = useState<ScoreBand[]>([]);
  const [statusColors, setStatusColors] = useState<Record<PlayStatus, string>>(
    DEFAULT_STATUS_COLORS
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  useEffect(() => {
    if (settings) {
      setBands(settings.scoreBadgeBands);
      setStatusColors(settings.statusColors);
    }
  }, [settings]);

  function updateBand(index: number, patch: Partial<ScoreBand>) {
    setBands((bs) => bs.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }
  function removeBand(index: number) {
    setBands((bs) => bs.filter((_, i) => i !== index));
  }
  function addBand() {
    setBands((bs) => [...bs, { min: 0, max: 100, bg: "#000000", fg: "#ffffff" }]);
  }
  function resetBands() {
    setBands(DEFAULT_SCORE_BANDS);
    saveSettings({ scoreBadgeBands: DEFAULT_SCORE_BANDS });
  }

  function updateStatusColor(key: PlayStatus, hex: string) {
    setStatusColors((c) => ({ ...c, [key]: hex }));
  }
  function resetStatusColors() {
    setStatusColors(DEFAULT_STATUS_COLORS);
    saveSettings({ statusColors: DEFAULT_STATUS_COLORS });
  }

  async function saveSettings(patch: Partial<SettingsShape> & { twitchClientSecret?: string }) {
    setSaving(true);
    setStatusMsg(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setSettings(data);
    setSaving(false);
    setStatusMsg("Saved.");
    setTwitchClientSecretInput("");
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

  if (!settings) return <p className="text-mute">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-parchment">Settings</h1>
        <p className="mt-1 text-sm text-mute">
          Turn scrapers on or off and manage credentials without touching the server.
        </p>
      </div>

      {statusMsg && <p className="text-sm text-amber">{statusMsg}</p>}

      {/* --- IGDB --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">IGDB metadata</h2>
          <Toggle
            checked={settings.igdbEnabled}
            onChange={(v) => saveSettings({ igdbEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          Cover art, release dates, summaries, genres. Requires free Twitch developer credentials.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Twitch Client ID</label>
            <input
              className="field"
              defaultValue={settings.twitchClientId}
              onBlur={(e) => saveSettings({ twitchClientId: e.target.value })}
            />
          </div>
          <div>
            <label className="label">
              Twitch Client Secret{" "}
              {settings.hasTwitchClientSecret && (
                <span className="text-xs text-mute">(currently set)</span>
              )}
            </label>
            <input
              type="password"
              className="field"
              placeholder={settings.hasTwitchClientSecret ? "••••••••" : ""}
              value={twitchClientSecretInput}
              onChange={(e) => setTwitchClientSecretInput(e.target.value)}
              onBlur={() =>
                twitchClientSecretInput &&
                saveSettings({ twitchClientSecret: twitchClientSecretInput })
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
            checked={settings.hltbEnabled}
            onChange={(v) => saveSettings({ hltbEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          Completion time estimates. Uses an unofficial endpoint with no credentials needed.
        </p>
      </section>

      {/* --- PriceCharting --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">PriceCharting</h2>
          <Toggle
            checked={settings.priceChartingEnabled}
            onChange={(v) => saveSettings({ priceChartingEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          Current resale values, converted from USD to GBP.
        </p>
        <div className="mt-4">
          <label className="label">Currency conversion API URL</label>
          <input
            className="field"
            defaultValue={settings.currencyApiUrl}
            placeholder="https://api.exchangerate.host/latest?base=USD&symbols=GBP"
            onBlur={(e) => saveSettings({ currencyApiUrl: e.target.value })}
          />
        </div>
      </section>

      {/* --- Score badges --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">Score badges</h2>
          <Toggle
            checked={settings.scoreBadgeEnabled}
            onChange={(v) => saveSettings({ scoreBadgeEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          The circle on each cover on the home page shows that game&rsquo;s IGDB
          score. Pick the circle and text colour for each score range.
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
                onChange={(e) =>
                  updateBand(i, { min: clampScore(parseInt(e.target.value, 10)) })
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                className="field"
                value={band.max}
                onChange={(e) =>
                  updateBand(i, { max: clampScore(parseInt(e.target.value, 10)) })
                }
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
            onClick={() => saveSettings({ scoreBadgeBands: bands })}
            className="btn-primary text-xs"
          >
            Save badge colours
          </button>
          <button type="button" onClick={resetBands} className="btn-secondary text-xs">
            Reset to defaults
          </button>
        </div>
      </section>

      {/* --- Play status --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">Play status</h2>
          <Toggle
            checked={settings.statusBadgeEnabled}
            onChange={(v) => saveSettings({ statusBadgeEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          A coloured dot on the bottom-left of each cover shows whether a game is
          unplayed, in progress or completed. Set each dot&rsquo;s colour below.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-parchment">
            Dim completed &amp; platinum covers
          </span>
          <Toggle
            checked={settings.dimCompleted}
            onChange={(v) => saveSettings({ dimCompleted: v })}
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
            onClick={() => saveSettings({ statusColors })}
            className="btn-primary text-xs"
          >
            Save status colours
          </button>
          <button
            type="button"
            onClick={resetStatusColors}
            className="btn-secondary text-xs"
          >
            Reset to defaults
          </button>
        </div>
      </section>

      {/* --- Barcode lookup --- */}
      <section className="rounded-card border border-ink-line bg-ink-soft p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-parchment">Barcode lookup</h2>
          <Toggle
            checked={settings.barcodeLookupEnabled}
            onChange={(v) => saveSettings({ barcodeLookupEnabled: v })}
          />
        </div>
        <p className="mt-1 text-sm text-mute">
          Powers the &ldquo;Scan barcode&rdquo; button on the Add a game screen.
          Resolves a scanned UPC/EAN to a product name, which is then searched on
          IGDB. Default is UPCitemdb&rsquo;s free tier (no key, ~100/day).
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
            defaultValue={settings.barcodeApiUrl}
            placeholder="https://api.upcitemdb.com/prod/trial/lookup?upc="
            onBlur={(e) => saveSettings({ barcodeApiUrl: e.target.value })}
          />
        </div>
      </section>

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
