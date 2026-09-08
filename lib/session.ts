import { cookies, headers } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";
import { prisma } from "@/lib/prisma";
import { ensureTenancy } from "@/lib/tenant";

// Web clients authenticate via the httpOnly session cookie. Native
// clients (the Android app) have no cookie jar worth relying on across
// app restarts, so they instead send `Authorization: Bearer <token>`
// with the same JWT the cookie would carry — captured once from the
// login response body. Cookie wins when both are somehow present.
function bearerToken(): string | null {
  const auth = headers().get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value ?? bearerToken();
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (user) await ensureTenancy();
  return user;
}
