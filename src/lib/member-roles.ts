import { eq } from "drizzle-orm";
import { db } from "../db";
import { memberRoles, roles } from "../db/schema";

export async function getMemberRoleNames(memberId: string): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(eq(memberRoles.memberId, memberId));

  return rows.map((row) => row.name);
}
