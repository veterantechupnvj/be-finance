import { z } from "@hono/zod-openapi";
import { createSuccessSchema, dateSchema, uuidSchema } from "../../lib/openapi";

export const divisionSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    isActive: z.boolean(),
    unitId: uuidSchema.nullable(),
  })
  .openapi("ReferenceDivision");

export const staffPeriodSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    startDate: dateSchema,
    endDate: dateSchema.nullable(),
    isActive: z.boolean(),
  })
  .openapi("ReferenceStaffPeriod");

export const divisionsResponseSchema = createSuccessSchema(z.array(divisionSchema));
export const staffPeriodsResponseSchema = createSuccessSchema(z.array(staffPeriodSchema));
export const activeStaffPeriodResponseSchema = createSuccessSchema(staffPeriodSchema);
