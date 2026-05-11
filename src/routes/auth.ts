// src/routes/auth.ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { members, users, roles, memberRoles } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/auth";
import { signAccessToken } from "../lib/jwt";
import type { TokenPayload } from "../lib/jwt";
import { ok, err } from "../lib/response";
import { requireAuth } from "../middleware/auth";
import "../types";

const auth = new Hono();

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const loginSchema = z.object({
  nim: z.string().min(1, "NIM is required"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// ============================================================
// HELPERS
// ============================================================

async function getMemberRoles(memberId: string): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(eq(memberRoles.memberId, memberId));

  return rows.map((r) => r.name);
}

// ============================================================
// POST /auth/login
// ============================================================

auth.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const { nim, password } = parsed.data;

  const [row] = await db
    .select({
      userId: users.id,
      memberId: members.id,
      nim: members.nim,
      name: members.name,
      passwordHash: users.passwordHash,
      mustChangePassword: users.mustChangePassword,
      isActive: users.isActive,
    })
    .from(users)
    .innerJoin(members, eq(users.memberId, members.id))
    .where(eq(members.nim, nim))
    .limit(1);

  // Use same error message for missing user and wrong password to prevent user enumeration
  if (!row || !row.isActive) {
    return c.json(err("UNAUTHORIZED", "Invalid credentials"), 401);
  }

  const valid = await verifyPassword(row.passwordHash, password);
  if (!valid) {
    return c.json(err("UNAUTHORIZED", "Invalid credentials"), 401);
  }

  const roleNames = await getMemberRoles(row.memberId);

  const payload: Omit<TokenPayload, "exp"> = {
    sub: row.userId,
    memberId: row.memberId,
    nim: row.nim,
    roles: roleNames,
    mustChangePassword: row.mustChangePassword,
  };

  const token = await signAccessToken(payload);

  await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, row.userId));

  return c.json(
    ok({
      token,
      mustChangePassword: row.mustChangePassword,
      member: {
        id: row.memberId,
        name: row.name,
        nim: row.nim,
        roles: roleNames,
      },
    }),
  );
});

// ============================================================
// GET /auth/me
// ============================================================

auth.get("/me", requireAuth, async (c) => {
  const user = c.get("user") as TokenPayload;

  const [row] = await db
    .select({
      id: members.id,
      name: members.name,
      nim: members.nim,
      cohortYear: members.cohortYear,
      memberType: members.memberType,
      status: members.status,
    })
    .from(members)
    .where(eq(members.id, user.memberId))
    .limit(1);

  if (!row) {
    return c.json(err("NOT_FOUND", "Member not found"), 404);
  }

  const roleNames = await getMemberRoles(row.id);

  return c.json(ok({ ...row, roles: roleNames }));
});

// ============================================================
// POST /auth/change-password
// ============================================================

auth.post("/change-password", requireAuth, async (c) => {
  const parsed = changePasswordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const { currentPassword, newPassword } = parsed.data;
  const user = c.get("user") as TokenPayload;

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.sub))
    .limit(1);

  if (!row) {
    return c.json(err("NOT_FOUND", "User not found"), 404);
  }

  const valid = await verifyPassword(row.passwordHash, currentPassword);
  if (!valid) {
    return c.json(err("UNAUTHORIZED", "Current password is incorrect"), 401);
  }

  const newHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash: newHash, mustChangePassword: false })
    .where(eq(users.id, user.sub));

  return c.json(ok({ message: "Password changed successfully" }));
});

// ============================================================
// POST /auth/logout
// NOTE: JWT is stateless — this endpoint only signals the client
// to clear its token. The token remains valid until expiry (8h).
// For production-grade invalidation, implement a token blocklist
// in Redis or a DB table and check it in requireAuth middleware.
// ============================================================

auth.post("/logout", requireAuth, async (c) => {
  return c.json(ok({ message: "Logged out successfully" }));
});

export default auth;
