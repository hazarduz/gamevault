"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsShape {
  igdbEnabled: boolean;
  twitchClientId: string;
  hasTwitchClientSecret: boolean;
  hltbEnabled: boolean;
  priceChartingEnabled: boolean;
  currencyApiUrl: string;
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

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

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
