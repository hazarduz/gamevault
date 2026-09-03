// Edge-safe: only uses "jose", which has no Node.js-only dependencies.
// Kept separate from lib/password.ts (bcryptjs) because middleware.ts
// runs on the Edge Runtime and can't bundle Node-only modules like
// "crypto" that bcryptjs reaches for internally.
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "gv_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a long random string for it in .env — see .env.example."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;

// Whether the *client-facing* request arrived over HTTPS. The reverse
// proxy in front of gamevault.hazarduz.win signals this with
// x-forwarded-proto; a direct hit to the box on the LAN
// (http://<ip>:3000) has no such header and resolves to http.
//
// The session cookie's Secure flag is keyed off this rather than
// NODE_ENV: inside the container NODE_ENV is always "production" even for
// plain-http LAN access, and a Secure cookie sent over http is silently
// dropped by the browser — which is why logging in via the LAN address
// used to just hang (cookie set, cookie discarded, every page then
// bounced back to /login).
export function requestIsHttps(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

export function setSessionCookie(
  req: NextRequest,
  res: NextResponse,
  token: string
): void {
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: requestIsHttps(req),
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
