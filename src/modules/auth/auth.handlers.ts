import { eq } from "drizzle-orm";
import { db } from "../../db";
import { members, users } from "../../db/schema";
import { verifyPassword, hashPassword } from "../../lib/auth";
import { signAccessToken, type TokenPayload } from "../../lib/jwt";
import { getMemberRoleNames } from "../../lib/member-roles";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import { changePasswordRoute, loginRoute, logoutRoute, meRoute } from "./auth.routes";

export const loginHandler: AppRouteHandler<typeof loginRoute> = async (c) => {
  const { nim, password } = c.req.valid("json");

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

  if (!row || !row.isActive) {
    return c.json(err("UNAUTHORIZED", "Invalid credentials"), 401);
  }

  const isValid = await verifyPassword(row.passwordHash, password);
  if (!isValid) {
    return c.json(err("UNAUTHORIZED", "Invalid credentials"), 401);
  }

  const roleNames = await getMemberRoleNames(row.memberId);

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
    200,
  );
};

export const meHandler: AppRouteHandler<typeof meRoute> = async (c) => {
  const user = c.get("user");

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

  const roleNames = await getMemberRoleNames(row.id);

  return c.json(ok({ ...row, roles: roleNames }), 200);
};

export const changePasswordHandler: AppRouteHandler<typeof changePasswordRoute> = async (c) => {
  const { currentPassword, newPassword } = c.req.valid("json");
  const user = c.get("user");

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.sub))
    .limit(1);

  if (!row) {
    return c.json(err("NOT_FOUND", "User not found"), 404);
  }

  const isValid = await verifyPassword(row.passwordHash, currentPassword);
  if (!isValid) {
    return c.json(err("UNAUTHORIZED", "Current password is incorrect"), 401);
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, user.sub));

  return c.json(ok({ message: "Password changed successfully" }), 200);
};

export const logoutHandler: AppRouteHandler<typeof logoutRoute> = async (c) => {
  return c.json(ok({ message: "Logged out successfully" }), 200);
};
