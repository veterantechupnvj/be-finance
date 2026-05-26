import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { divisions, staffPeriods } from "../../db/schema";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import { getActiveStaffPeriodRoute, listDivisionsRoute, listStaffPeriodsRoute } from "./ref.routes";

export const listDivisionsHandler: AppRouteHandler<typeof listDivisionsRoute> = async (c) => {
  const rows = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      is_active: divisions.isActive,
      unit_id: divisions.unitId,
    })
    .from(divisions)
    .where(eq(divisions.isActive, true))
    .orderBy(divisions.name);

  return c.json(ok(rows), 200);
};

export const listStaffPeriodsHandler: AppRouteHandler<typeof listStaffPeriodsRoute> = async (c) => {
  const rows = await db
    .select({
      id: staffPeriods.id,
      name: staffPeriods.name,
      start_date: staffPeriods.startDate,
      end_date: staffPeriods.endDate,
      is_active: staffPeriods.isActive,
    })
    .from(staffPeriods)
    .orderBy(desc(staffPeriods.startDate));

  return c.json(ok(rows), 200);
};

export const getActiveStaffPeriodHandler: AppRouteHandler<
  typeof getActiveStaffPeriodRoute
> = async (c) => {
  const [row] = await db
    .select({
      id: staffPeriods.id,
      name: staffPeriods.name,
      start_date: staffPeriods.startDate,
      end_date: staffPeriods.endDate,
      is_active: staffPeriods.isActive,
    })
    .from(staffPeriods)
    .where(eq(staffPeriods.isActive, true))
    .limit(1);

  if (!row) {
    return c.json(err("NOT_FOUND", "Active staff period not found"), 404);
  }

  return c.json(ok(row), 200);
};
