"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Only allow same-origin relative paths as a post-login destination, so
// a crafted ?next=https://evil.example can't turn this into an open
// redirect.
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => setIsFirstRun(!data.hasUser))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isFirstRun && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(isFirstRun ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      // Hard navigation, not router.push(): it guarantees the next
      // request is a fresh top-level load that carries the just-set
      // session cookie. The client-router version raced the Set-Cookie
      // and would sometimes land back on /login until a manual refresh.
      window.location.assign(safeNext(searchParams.get("next")));
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p className="text-mute">Loading…</p>;
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="font-display text-2xl font-bold text-parchment">
        {isFirstRun ? "Set up GameVault" : "Log in"}
      </h1>
      <p className="mt-1 text-sm text-mute">
        {isFirstRun
          ? "Create the admin account that will manage this collection."
          : "Welcome back."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label">Username</label>
          <input
            className="field"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="field"
            required
            minLength={isFirstRun ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {isFirstRun && (
          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              className="field"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Please wait…" : isFirstRun ? "Create account" : "Log in"}
        </button>
      </form>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary during static
// generation, otherwise the production build fails.
export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-mute">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
