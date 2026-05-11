import { Hono } from "hono";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../db";
import { divisions, memberRoles, members, roles, staffMembers, staffPeriods } from "../db/schema";
import { err, ok } from "../lib/response";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = new Hono();

async function getMemberRoleNames(memberId: string): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(eq(memberRoles.memberId, memberId));

  return rows.map((row) => row.name);
}

router.get("/", requireAuth, requireRole("finance"), async (c) => {
  const rawPage = Number(c.req.query("page") ?? 1);
  const rawPerPage = Number(c.req.query("per_page") ?? 20);
  const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;
  const perPage = Number.isFinite(rawPerPage) ? Math.min(Math.max(rawPerPage, 1), 100) : 20;
  const search = c.req.query("search");
  const status = c.req.query("status");
  const memberType = c.req.query("member_type");
  const cohortYear = c.req.query("cohort_year");

  const conditions: SQL[] = [];

  if (search) {
    conditions.push(or(ilike(members.name, `%${search}%`), ilike(members.nim, `%${search}%`))!);
  }
  if (status) conditions.push(eq(members.status, status as "active" | "inactive"));
  if (memberType) {
    conditions.push(eq(members.memberType, memberType as "member" | "staff" | "alumni"));
  }
  if (cohortYear) {
    const parsedCohortYear = Number(cohortYear);
    if (Number.isFinite(parsedCohortYear)) {
      conditions.push(eq(members.cohortYear, parsedCohortYear));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select({
        id: members.id,
        name: members.name,
        nim: members.nim,
        cohortYear: members.cohortYear,
        memberType: members.memberType,
        status: members.status,
      })
      .from(members)
      .where(where)
      .orderBy(members.name)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.$count(members, where),
  ]);

  return c.json({
    success: true,
    data: rows,
    meta: {
      total: Number(total),
      page,
      per_page: perPage,
      total_pages: Math.ceil(Number(total) / perPage),
    },
  });
});

router.get("/:id", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();

  const [member] = await db
    .select({
      id: members.id,
      name: members.name,
      nim: members.nim,
      cohortYear: members.cohortYear,
      memberType: members.memberType,
      status: members.status,
    })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);

  if (!member) {
    return c.json(err("NOT_FOUND", "Member not found"), 404);
  }

  const [staffAssignments, roleNames] = await Promise.all([
    db
      .select({
        division: divisions.name,
        position: staffMembers.position,
      })
      .from(staffMembers)
      .innerJoin(staffPeriods, eq(staffMembers.staffId, staffPeriods.id))
      .innerJoin(divisions, eq(staffMembers.divisionId, divisions.id))
      .where(and(eq(staffMembers.memberId, id), eq(staffPeriods.isActive, true)))
      .orderBy(desc(staffMembers.createdAt))
      .limit(1),
    getMemberRoleNames(id),
  ]);

  const staffAssignment = staffAssignments[0];

  return c.json(
    ok({
      ...member,
      role: roleNames[0] ?? "member",
      roles: roleNames,
      division: staffAssignment?.division ?? null,
      position: staffAssignment?.position ?? null,
    }),
  );
});

export default router;
