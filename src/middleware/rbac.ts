// src/middleware/rbac.ts
import type { Context, Next } from "hono";
import type { TokenPayload } from "../lib/jwt";
import { err } from "../lib/response";

export function requireRole(...requiredRoles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as TokenPayload | undefined;

    if (!user) {
      return c.json(err("UNAUTHORIZED", "Authentication required"), 401);
    }

    const hasRole = user.roles.some((r) => requiredRoles.includes(r));
    if (!hasRole) {
      return c.json(err("FORBIDDEN", "You do not have permission to perform this action"), 403);
    }

    await next();
  };
}
