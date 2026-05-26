import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { finCategories } from "../../db/schema";
import { writeAudit } from "../../lib/audit";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import { createCategoryRoute, listCategoriesRoute, updateCategoryRoute } from "./categories.routes";

export const listCategoriesHandler: AppRouteHandler<typeof listCategoriesRoute> = async (c) => {
  const { type } = c.req.valid("query");

  const conditions = [eq(finCategories.isActive, true)];
  if (type) {
    conditions.push(eq(finCategories.type, type));
  }

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

  return c.json(ok(rows), 200);
};

export const createCategoryHandler: AppRouteHandler<typeof createCategoryRoute> = async (c) => {
  const user = c.get("user");
  const { name, type, parent_id } = c.req.valid("json");

  const [created] = await db
    .insert(finCategories)
    .values({
      name,
      type,
      parentId: parent_id ?? null,
    })
    .returning();

  if (!created) {
    return c.json(err("INTERNAL_ERROR", "Failed to create category"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_categories",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
};

export const updateCategoryHandler: AppRouteHandler<typeof updateCategoryRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [existing] = await db.select().from(finCategories).where(eq(finCategories.id, id)).limit(1);

  if (!existing) {
    return c.json(err("NOT_FOUND", "Category not found"), 404);
  }

  const updates: Partial<typeof finCategories.$inferInsert> = {};
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.is_active !== undefined) {
    updates.isActive = body.is_active;
  }

  const [updated] = await db
    .update(finCategories)
    .set(updates)
    .where(eq(finCategories.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to update category"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_categories",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated), 200);
};
