import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { divisions, members, staffMembers, staffPeriods } from "../../db/schema";
import { getMemberRoleNames } from "../../lib/member-roles";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import { getMemberRoute, listMembersRoute } from "./members.routes";

export const listMembersHandler: AppRouteHandler<typeof listMembersRoute> = async (c) => {
  const query = c.req.valid("query");
  const page = Math.max(query.page ?? 1, 1);
  const perPage = Math.min(Math.max(query.per_page ?? 20, 1), 100);

  const conditions: SQL[] = [];

  if (query.search) {
    conditions.push(
      or(ilike(members.name, `%${query.search}%`), ilike(members.nim, `%${query.search}%`))!,
    );
  }
  if (query.status) {
    conditions.push(eq(members.status, query.status));
  }
  if (query.member_type) {
    conditions.push(eq(members.memberType, query.member_type));
  }
  if (query.cohort_year !== undefined) {
    conditions.push(eq(members.cohortYear, query.cohort_year));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select({
        id: members.id,
        name: members.name,
        nim: members.nim,
        cohort_year: members.cohortYear,
        member_type: members.memberType,
        status: members.status,
      })
      .from(members)
      .where(where)
      .orderBy(members.name)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.$count(members, where),
  ]);

  const count = Number(total);

  return c.json(
    {
      success: true,
      data: rows,
      meta: {
        total: count,
        page,
        per_page: perPage,
        total_pages: Math.ceil(count / perPage),
      },
    },
    200,
  );
};

export const getMemberHandler: AppRouteHandler<typeof getMemberRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const [member] = await db
    .select({
      id: members.id,
      name: members.name,
      nim: members.nim,
      cohort_year: members.cohortYear,
      member_type: members.memberType,
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
    200,
  );
};
