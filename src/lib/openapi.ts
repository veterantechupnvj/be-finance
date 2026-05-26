import { z } from "@hono/zod-openapi";
import type { ZodType } from "zod";

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("ErrorResponse");

export const paginationMetaSchema = z
  .object({
    total: z.number().int(),
    page: z.number().int(),
    per_page: z.number().int(),
    total_pages: z.number().int(),
  })
  .openapi("PaginationMeta");

export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().date();
export const dateTimeSchema = z.string().datetime();

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const memberIdParamSchema = z.object({
  member_id: uuidSchema,
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
});

export const yearQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
});

export function createSuccessSchema<T extends ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export function createPaginatedSchema<T extends ZodType>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

export function jsonContent<T extends ZodType>(schema: T) {
  return {
    "application/json": {
      schema,
    },
  };
}

export const standardErrorResponses = {
  401: {
    content: jsonContent(errorResponseSchema),
    description: "Unauthorized",
  },
  403: {
    content: jsonContent(errorResponseSchema),
    description: "Forbidden",
  },
  404: {
    content: jsonContent(errorResponseSchema),
    description: "Not found",
  },
  409: {
    content: jsonContent(errorResponseSchema),
    description: "Conflict",
  },
  422: {
    content: jsonContent(errorResponseSchema),
    description: "Validation error",
  },
  500: {
    content: jsonContent(errorResponseSchema),
    description: "Internal server error",
  },
} as const;

export const bearerSecurity = [{ bearerAuth: [] as string[] }];
