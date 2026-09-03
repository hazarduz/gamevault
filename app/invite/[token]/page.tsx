"use client";

import { useEffect, useState } from "react";

export default function InvitePage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<"checking" | "valid" | "invalid">("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/invite?token=${encodeURIComponent(params.token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setUsername(d.username);
          setState("valid");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      window.location.assign("/");
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (state === "checking") {
    return <p className="mx-auto mt-16 max-w-sm text-mute">Checking invite…</p>;
  }

  if (state === "invalid") {
    return (
      <div className="mx-auto mt-16 max-w-sm">
        <h1 className="font-display text-2xl font-bold text-parchment">
          Invite not valid
        </h1>
        <p className="mt-2 text-sm text-mute">
          This invite link is no longer valid. Ask the person who runs this
          GameVault for a fresh one.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="font-display text-2xl font-bold text-parchment">
        Welcome to GameVault
      </h1>
      <p className="mt-1 text-sm text-mute">
        Set a password for <span className="text-parchment">{username}</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="field"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input
            type="password"
            className="field"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Please wait…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
