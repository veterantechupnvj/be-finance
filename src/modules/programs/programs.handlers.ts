import { and, eq, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { divisions, programs } from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import {
  createProgramRoute,
  getProgramRoute,
  listProgramsRoute,
  updateProgramRoute,
} from "./programs.routes";

export const listProgramsHandler: AppRouteHandler<typeof listProgramsRoute> = async (c) => {
  const query = c.req.valid("query");
  const conditions: SQL[] = [];

  if (query.status) {
    conditions.push(eq(programs.status, query.status));
  }
  if (query.type) {
    conditions.push(eq(programs.type, query.type));
  }
  if (query.division_id) {
    conditions.push(eq(programs.divisionId, query.division_id));
  }

  const rows = await db
    .select({
      id: programs.id,
      name: programs.name,
      type: programs.type,
      status: programs.status,
      budget: programs.budget,
      description: programs.description,
      startDate: programs.startDate,
      endDate: programs.endDate,
      division: divisions.name,
    })
    .from(programs)
    .leftJoin(divisions, eq(programs.divisionId, divisions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(programs.startDate);

  return c.json(ok(rows), 200);
};

export const getProgramHandler: AppRouteHandler<typeof getProgramRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const [row] = await db
    .select({
      id: programs.id,
      name: programs.name,
      type: programs.type,
      status: programs.status,
      budget: programs.budget,
      description: programs.description,
      startDate: programs.startDate,
      endDate: programs.endDate,
      divisionId: programs.divisionId,
      division: divisions.name,
    })
    .from(programs)
    .leftJoin(divisions, eq(programs.divisionId, divisions.id))
    .where(eq(programs.id, id))
    .limit(1);

  if (!row) {
    return c.json(err("NOT_FOUND", "Program not found"), 404);
  }

  return c.json(ok(row), 200);
};

export const createProgramHandler: AppRouteHandler<typeof createProgramRoute> = async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

  const [created] = await db
    .insert(programs)
    .values({
      name: data.name,
      type: data.type,
      divisionId: data.division_id ?? null,
      budget: data.budget ? String(data.budget) : null,
      status: data.status,
      description: data.description ?? null,
      startDate: data.start_date ?? null,
      endDate: data.end_date ?? null,
      createdBy: user.memberId,
    })
    .returning();

  if (!created) {
    return c.json(err("INTERNAL_ERROR", "Failed to create program"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "programs",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
};

export const updateProgramHandler: AppRouteHandler<typeof updateProgramRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const [existing] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);

  if (!existing) {
    return c.json(err("NOT_FOUND", "Program not found"), 404);
  }

  const updates: Partial<typeof programs.$inferInsert> = {};
  if (data.name !== undefined) {
    updates.name = data.name;
  }
  if (data.type !== undefined) {
    updates.type = data.type;
  }
  if (data.status !== undefined) {
    updates.status = data.status;
  }
  if (data.division_id !== undefined) {
    updates.divisionId = data.division_id ?? null;
  }
  if (data.budget !== undefined) {
    updates.budget = data.budget ? String(data.budget) : null;
  }
  if (data.description !== undefined) {
    updates.description = data.description ?? null;
  }
  if (data.start_date !== undefined) {
    updates.startDate = data.start_date ?? null;
  }
  if (data.end_date !== undefined) {
    updates.endDate = data.end_date ?? null;
  }

  const [updated] = await db.update(programs).set(updates).where(eq(programs.id, id)).returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to update program"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "programs",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated), 200);
};
