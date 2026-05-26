import { z } from "@hono/zod-openapi";
import { createSuccessSchema, dateSchema, uuidSchema } from "../../lib/openapi";

export const divisionSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    is_active: z.boolean(),
    unit_id: uuidSchema.nullable(),
  })
  .openapi("ReferenceDivision");

export const staffPeriodSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    start_date: dateSchema,
    end_date: dateSchema.nullable(),
    is_active: z.boolean(),
  })
  .openapi("ReferenceStaffPeriod");

export const divisionsResponseSchema = createSuccessSchema(z.array(divisionSchema));
export const staffPeriodsResponseSchema = createSuccessSchema(z.array(staffPeriodSchema));
export const activeStaffPeriodResponseSchema = createSuccessSchema(staffPeriodSchema);
