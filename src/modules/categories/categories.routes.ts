import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  categoriesListQuerySchema,
  categoriesResponseSchema,
  categoryPathSchema,
  categoryResponseSchema,
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
} from "./categories.schema";

const financeOnly = [requireAuth, requireRole("finance")];

export const listCategoriesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Categories"],
  summary: "List finance categories",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    query: categoriesListQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(categoriesResponseSchema),
      description: "Categories",
    },
    401: standardErrorResponses[401],
  },
});

export const createCategoryRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Categories"],
  summary: "Create a finance category",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(createCategoryRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(categoryResponseSchema),
      description: "Category created",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const updateCategoryRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Categories"],
  summary: "Update a finance category",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: categoryPathSchema,
    body: {
      content: jsonContent(updateCategoryRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(categoryResponseSchema),
      description: "Category updated",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});
