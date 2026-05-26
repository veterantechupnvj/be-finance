import { z } from "@hono/zod-openapi";
import { createSuccessSchema, dateSchema, idParamSchema, uuidSchema } from "../../lib/openapi";

export const programsListQuerySchema = z
  .object({
    status: z.enum(["planning", "active", "completed", "cancelled"]).optional(),
    type: z.enum(["event", "recurring", "external", "flagship"]).optional(),
    division_id: uuidSchema.optional(),
  })
  .openapi("ProgramsListQuery");

export const programPathSchema = idParamSchema.openapi("ProgramPathParams");

export const createProgramRequestSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["event", "recurring", "external", "flagship"]),
    division_id: uuidSchema.nullable().optional(),
    budget: z.number().positive().nullable().optional(),
    status: z.enum(["planning", "active", "completed", "cancelled"]).default("planning"),
    description: z.string().nullable().optional(),
    start_date: dateSchema.nullable().optional(),
    end_date: dateSchema.nullable().optional(),
  })
  .openapi("CreateProgramRequest");

export const updateProgramRequestSchema = createProgramRequestSchema
  .partial()
  .openapi("UpdateProgramRequest");

export const programSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    type: z.string(),
    status: z.string(),
    budget: z.union([z.string(), z.number()]).nullable(),
    description: z.string().nullable(),
    start_date: dateSchema.nullable(),
    end_date: dateSchema.nullable(),
    division: z.string().nullable().optional(),
    division_id: uuidSchema.nullable().optional(),
  })
  .openapi("Program");

export const programsResponseSchema = createSuccessSchema(z.array(programSchema));
export const programResponseSchema = createSuccessSchema(programSchema);
