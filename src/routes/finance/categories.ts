// src/routes/finance/categories.ts
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { finCategories } from "../../db/schema";
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
  type: z.enum(["income", "expense"]),
  parent_id: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

// ============================================================
// GET /finance/categories
// [member] — list active categories, optionally filtered by type
// ============================================================

router.get("/", requireAuth, async (c) => {
  const type = c.req.query("type") as "income" | "expense" | undefined;

  const conditions = [eq(finCategories.isActive, true)];
  if (type) conditions.push(eq(finCategories.type, type));

  const rows = await db
    .select({
      id: finCategories.id,
      name: finCategories.name,
      type: finCategories.type,
      parentId: finCategories.parentId,
      isActive: finCategories.isActive,
    })
    .from(finCategories)
    .where(and(...conditions))
    .orderBy(finCategories.type, finCategories.name);

  return c.json(ok(rows));
});

// ============================================================
// POST /finance/categories
// [finance] — create a new category
// ============================================================

router.post("/", requireAuth, requireRole("finance"), async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const { name, type, parent_id } = parsed.data;

  const [created] = await db
    .insert(finCategories)
    .values({ name, type, parentId: parent_id ?? null })
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_categories",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
});

// ============================================================
// PATCH /finance/categories/:id
// [finance] — update name or active status
// ============================================================

router.patch("/:id", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [existing] = await db.select().from(finCategories).where(eq(finCategories.id, id)).limit(1);

  if (!existing) {
    return c.json(err("NOT_FOUND", "Category not found"), 404);
  }

  const updates: Partial<typeof finCategories.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.is_active !== undefined) updates.isActive = parsed.data.is_active;

  const [updated] = await db
    .update(finCategories)
    .set(updates)
    .where(eq(finCategories.id, id))
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_categories",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated));
});

export default router;
