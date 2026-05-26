import { z } from "@hono/zod-openapi";
import { createSuccessSchema, idParamSchema, uuidSchema } from "../../lib/openapi";

export const categoriesListQuerySchema = z
  .object({
    type: z.enum(["income", "expense"]).optional(),
  })
  .openapi("CategoriesListQuery");

export const createCategoryRequestSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["income", "expense"]),
    parent_id: uuidSchema.nullable().optional(),
  })
  .openapi("CreateCategoryRequest");

export const updateCategoryRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi("UpdateCategoryRequest");

export const categoryPathSchema = idParamSchema.openapi("CategoryPathParams");

export const categorySchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    type: z.enum(["income", "expense"]),
    parentId: uuidSchema.nullable(),
    isActive: z.boolean(),
  })
  .openapi("Category");

export const categoriesResponseSchema = createSuccessSchema(z.array(categorySchema));
export const categoryResponseSchema = createSuccessSchema(categorySchema);
