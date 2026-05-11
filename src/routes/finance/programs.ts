// src/routes/finance/programs.ts
import { Hono } from "hono";
import { eq, and, SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { programs, divisions } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { ok, err } from "../../lib/response";
import { writeAudit } from "../../lib/audit";
import type { TokenPayload } from "../../lib/jwt";

const router = new Hono();

// ============================================================
// VALIDATION
// ============================================================

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["event", "recurring", "external", "flagship"]),
  division_id: z.string().uuid().nullable().optional(),
  budget: z.number().positive().nullable().optional(),
  status: z.enum(["planning", "active", "completed", "cancelled"]).default("planning"),
  description: z.string().nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
});

const updateSchema = createSchema.partial();

// ============================================================
// GET /finance/programs
// [member] — list programs with optional filters
// ============================================================

router.get("/", requireAuth, async (c) => {
  const status = c.req.query("status");
  const type = c.req.query("type");
  const divisionId = c.req.query("division_id");

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(programs.status, status as any));
  if (type) conditions.push(eq(programs.type, type as any));
  if (divisionId) conditions.push(eq(programs.divisionId, divisionId));

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

  return c.json(ok(rows));
});

// ============================================================
// GET /finance/programs/:id
// [member] — single program detail
// ============================================================

router.get("/:id", requireAuth, async (c) => {
  const { id } = c.req.param();

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

  if (!row) return c.json(err("NOT_FOUND", "Program not found"), 404);

  return c.json(ok(row));
});

// ============================================================
// POST /finance/programs
// [finance] — create program
// ============================================================

router.post("/", requireAuth, requireRole("finance"), async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const data = parsed.data;

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

  await writeAudit({
    actorId: user.memberId,
    entityType: "programs",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
});

// ============================================================
// PATCH /finance/programs/:id
// [finance] — update program
// ============================================================

router.patch("/:id", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [existing] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);

  if (!existing) return c.json(err("NOT_FOUND", "Program not found"), 404);

  const data = parsed.data;
  const updates: Partial<typeof programs.$inferInsert> = {};
  if (data.name) updates.name = data.name;
  if (data.type) updates.type = data.type;
  if (data.status) updates.status = data.status;
  if (data.division_id !== undefined) updates.divisionId = data.division_id ?? null;
  if (data.budget !== undefined) updates.budget = data.budget ? String(data.budget) : null;
  if (data.description !== undefined) updates.description = data.description ?? null;
  if (data.start_date !== undefined) updates.startDate = data.start_date ?? null;
  if (data.end_date !== undefined) updates.endDate = data.end_date ?? null;

  const [updated] = await db.update(programs).set(updates).where(eq(programs.id, id)).returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "programs",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated));
});

export default router;
