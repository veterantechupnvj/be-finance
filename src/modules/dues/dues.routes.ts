import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  duesConfigListResponseSchema,
  duesConfigPathSchema,
  duesConfigRequestSchema,
  duesConfigResponseSchema,
  duesListQuerySchema,
  duesListResponseSchema,
  duesMeQuerySchema,
  duesMeResponseSchema,
  duesPathSchema,
  exemptDuesRequestSchema,
  exemptDuesResponseSchema,
  payDuesRequestSchema,
  payDuesResponseSchema,
  verifyDuesResponseSchema,
} from "./dues.schema";

const financeOnly = [requireAuth, requireRole("finance")];

export const listDuesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Dues"],
  summary: "List member dues",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    query: duesListQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(duesListResponseSchema),
      description: "Dues records",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
  },
});

export const myDuesRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Dues"],
  summary: "Get the current member's dues",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    query: duesMeQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(duesMeResponseSchema),
      description: "Member dues",
    },
    401: standardErrorResponses[401],
  },
});

export const payDuesRoute = createRoute({
  method: "post",
  path: "/pay",
  tags: ["Dues"],
  summary: "Submit dues payment proof",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(payDuesRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(payDuesResponseSchema),
      description: "Payment submitted",
    },
    401: standardErrorResponses[401],
    409: standardErrorResponses[409],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const verifyDuesRoute = createRoute({
  method: "patch",
  path: "/{id}/verify",
  tags: ["Dues"],
  summary: "Verify a dues payment",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: duesPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(verifyDuesResponseSchema),
      description: "Dues verified",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    409: standardErrorResponses[409],
    500: standardErrorResponses[500],
  },
});

export const exemptDuesRoute = createRoute({
  method: "patch",
  path: "/{id}/exempt",
  tags: ["Dues"],
  summary: "Mark a dues record as exempt",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: duesPathSchema,
    body: {
      content: jsonContent(exemptDuesRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(exemptDuesResponseSchema),
      description: "Dues exempted",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    409: standardErrorResponses[409],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const getDuesConfigRoute = createRoute({
  method: "get",
  path: "/config/{member_id}",
  tags: ["Dues"],
  summary: "Get dues config for a member",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: duesConfigPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(duesConfigListResponseSchema),
      description: "Dues config rows",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
  },
});

export const upsertDuesConfigRoute = createRoute({
  method: "post",
  path: "/config",
  tags: ["Dues"],
  summary: "Create or update dues config",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(duesConfigRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(duesConfigResponseSchema),
      description: "Dues config saved",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});
