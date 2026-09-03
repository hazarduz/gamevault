// Node-only: bcryptjs is not Edge-Runtime-safe, so this file must never
// be imported from middleware.ts or any other Edge-executed code path.
// It's fine to import from regular API routes (app/api/**/route.ts),
// which run in the standard Node.js runtime.
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
