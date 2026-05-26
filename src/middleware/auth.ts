// src/middleware/auth.ts
import type { Context, Next } from "hono";
import { verifyToken } from "../lib/jwt";
import { err } from "../lib/response";

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(err("UNAUTHORIZED", "Missing or invalid authorization header"), 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);
    c.set("user", payload);

    // Block all endpoints except /auth/change-password until password is changed
    if (payload.mustChangePassword && !c.req.path.endsWith("/auth/change-password")) {
      return c.json(
        err("FORBIDDEN", "Password change required before accessing other resources."),
        403,
      );
    }

    await next();
  } catch {
    return c.json(err("UNAUTHORIZED", "Invalid or expired token"), 401);
  }
}
