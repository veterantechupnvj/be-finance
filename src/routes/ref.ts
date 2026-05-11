import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { divisions, staffPeriods } from "../db/schema";
import { err, ok } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const router = new Hono();

router.get("/divisions", requireAuth, async (c) => {
  const rows = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      isActive: divisions.isActive,
      unitId: divisions.unitId,
    })
    .from(divisions)
    .where(eq(divisions.isActive, true))
    .orderBy(divisions.name);

  return c.json(ok(rows));
});

router.get("/staff-periods", requireAuth, async (c) => {
  const rows = await db
    .select({
      id: staffPeriods.id,
      name: staffPeriods.name,
      startDate: staffPeriods.startDate,
      endDate: staffPeriods.endDate,
      isActive: staffPeriods.isActive,
    })
    .from(staffPeriods)
    .orderBy(desc(staffPeriods.startDate));

  return c.json(ok(rows));
});

router.get("/staff-periods/active", requireAuth, async (c) => {
  const [row] = await db
    .select({
      id: staffPeriods.id,
      name: staffPeriods.name,
      startDate: staffPeriods.startDate,
      endDate: staffPeriods.endDate,
      isActive: staffPeriods.isActive,
    })
    .from(staffPeriods)
    .where(eq(staffPeriods.isActive, true))
    .limit(1);

  if (!row) {
    return c.json(err("NOT_FOUND", "Active staff period not found"), 404);
  }

  return c.json(ok(row));
});

export default router;
