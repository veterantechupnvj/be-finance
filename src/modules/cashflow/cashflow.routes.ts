import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  cashflowDeleteResponseSchema,
  cashflowListQuerySchema,
  cashflowListResponseSchema,
  cashflowPathSchema,
  cashflowResponseSchema,
  cashflowSummaryQuerySchema,
  cashflowSummaryResponseSchema,
  createCashflowRequestSchema,
  deleteCashflowRequestSchema,
  updateCashflowRequestSchema,
} from "./cashflow.schema";

const financeOnly = [requireAuth, requireRole("finance")];

export const listCashflowRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Cashflow"],
  summary: "List cashflow entries",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    query: cashflowListQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(cashflowListResponseSchema),
      description: "Cashflow entries",
    },
    401: standardErrorResponses[401],
  },
});

export const cashflowSummaryRoute = createRoute({
  method: "get",
  path: "/summary",
  tags: ["Cashflow"],
  summary: "Get cashflow summary analytics",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    query: cashflowSummaryQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(cashflowSummaryResponseSchema),
      description: "Cashflow summary",
    },
    401: standardErrorResponses[401],
  },
});

export const createCashflowRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Cashflow"],
  summary: "Create a cashflow entry",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(createCashflowRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(cashflowResponseSchema),
      description: "Cashflow entry created",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const updateCashflowRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Cashflow"],
  summary: "Update a cashflow entry",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: cashflowPathSchema,
    body: {
      content: jsonContent(updateCashflowRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(cashflowResponseSchema),
      description: "Cashflow entry updated",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const deleteCashflowRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Cashflow"],
  summary: "Soft-delete a cashflow entry",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: cashflowPathSchema,
    body: {
      content: jsonContent(deleteCashflowRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(cashflowDeleteResponseSchema),
      description: "Cashflow entry deleted",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    422: standardErrorResponses[422],
  },
});
