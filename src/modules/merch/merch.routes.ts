import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  createMerchProductRequestSchema,
  merchDeleteResponseSchema,
  merchProductMutationResponseSchema,
  merchProductPathSchema,
  merchProductResponseSchema,
  merchProductsQuerySchema,
  merchProductsResponseSchema,
  merchSaleCreateResponseSchema,
  merchSalesQuerySchema,
  merchSalesResponseSchema,
  merchSummaryResponseSchema,
  recordMerchSaleRequestSchema,
  updateMerchProductRequestSchema,
} from "./merch.schema";

const financeOnly = [requireAuth, requireRole("finance")];

export const listMerchProductsRoute = createRoute({
  method: "get",
  path: "/products",
  tags: ["Merch"],
  summary: "List merch products",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    query: merchProductsQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(merchProductsResponseSchema),
      description: "Merch products",
    },
    401: standardErrorResponses[401],
  },
});

export const getMerchProductRoute = createRoute({
  method: "get",
  path: "/products/{id}",
  tags: ["Merch"],
  summary: "Get a merch product",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    params: merchProductPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(merchProductResponseSchema),
      description: "Merch product",
    },
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
  },
});

export const createMerchProductRoute = createRoute({
  method: "post",
  path: "/products",
  tags: ["Merch"],
  summary: "Create a merch product",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(createMerchProductRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(merchProductMutationResponseSchema),
      description: "Merch product created",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const updateMerchProductRoute = createRoute({
  method: "patch",
  path: "/products/{id}",
  tags: ["Merch"],
  summary: "Update a merch product",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: merchProductPathSchema,
    body: {
      content: jsonContent(updateMerchProductRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(merchProductMutationResponseSchema),
      description: "Merch product updated",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const deleteMerchProductRoute = createRoute({
  method: "delete",
  path: "/products/{id}",
  tags: ["Merch"],
  summary: "Soft-delete a merch product",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: merchProductPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(merchDeleteResponseSchema),
      description: "Merch product deleted",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    500: standardErrorResponses[500],
  },
});

export const listMerchSalesRoute = createRoute({
  method: "get",
  path: "/sales",
  tags: ["Merch"],
  summary: "List merch sales",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    query: merchSalesQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(merchSalesResponseSchema),
      description: "Merch sales",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
  },
});

export const createMerchSaleRoute = createRoute({
  method: "post",
  path: "/sales",
  tags: ["Merch"],
  summary: "Record a merch sale",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(recordMerchSaleRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(merchSaleCreateResponseSchema),
      description: "Merch sale recorded",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const merchSummaryRoute = createRoute({
  method: "get",
  path: "/summary",
  tags: ["Merch"],
  summary: "Get merch sales summary",
  middleware: financeOnly,
  security: bearerSecurity,
  responses: {
    200: {
      content: jsonContent(merchSummaryResponseSchema),
      description: "Merch summary",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
  },
});
