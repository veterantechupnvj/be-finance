import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  createReimbursementRequestSchema,
  markPaidRequestSchema,
  myReimbursementsResponseSchema,
  rejectReimbursementRequestSchema,
  reimbursementDetailResponseSchema,
  reimbursementMutationResponseSchema,
  reimbursementPathSchema,
  reimbursementStatusResponseSchema,
  reimbursementsListQuerySchema,
  reimbursementsResponseSchema,
} from "./reimbursements.schema";

const financeOnly = [requireAuth, requireRole("finance")];

export const listReimbursementsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Reimbursements"],
  summary: "List reimbursement requests",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    query: reimbursementsListQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(reimbursementsResponseSchema),
      description: "Reimbursement requests",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
  },
});

export const myReimbursementsRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Reimbursements"],
  summary: "List the current member's reimbursements",
  middleware: requireAuth,
  security: bearerSecurity,
  responses: {
    200: {
      content: jsonContent(myReimbursementsResponseSchema),
      description: "Current member reimbursement requests",
    },
    401: standardErrorResponses[401],
  },
});

export const getReimbursementRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Reimbursements"],
  summary: "Get a reimbursement request with audit trail",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    params: reimbursementPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(reimbursementDetailResponseSchema),
      description: "Reimbursement detail",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
  },
});

export const createReimbursementRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Reimbursements"],
  summary: "Submit a reimbursement request",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(createReimbursementRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(reimbursementMutationResponseSchema),
      description: "Reimbursement created",
    },
    401: standardErrorResponses[401],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const approveReimbursementRoute = createRoute({
  method: "patch",
  path: "/{id}/approve",
  tags: ["Reimbursements"],
  summary: "Approve a reimbursement request",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: reimbursementPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(reimbursementMutationResponseSchema),
      description: "Reimbursement approved",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    409: standardErrorResponses[409],
    500: standardErrorResponses[500],
  },
});

export const rejectReimbursementRoute = createRoute({
  method: "patch",
  path: "/{id}/reject",
  tags: ["Reimbursements"],
  summary: "Reject a reimbursement request",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: reimbursementPathSchema,
    body: {
      content: jsonContent(rejectReimbursementRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(reimbursementMutationResponseSchema),
      description: "Reimbursement rejected",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    409: standardErrorResponses[409],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const markReimbursementPaidRoute = createRoute({
  method: "patch",
  path: "/{id}/mark-paid",
  tags: ["Reimbursements"],
  summary: "Mark a reimbursement as paid",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: reimbursementPathSchema,
    body: {
      content: jsonContent(markPaidRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(reimbursementStatusResponseSchema),
      description: "Reimbursement marked paid",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    409: standardErrorResponses[409],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const cancelReimbursementRoute = createRoute({
  method: "patch",
  path: "/{id}/cancel",
  tags: ["Reimbursements"],
  summary: "Cancel a reimbursement request",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    params: reimbursementPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(reimbursementMutationResponseSchema),
      description: "Reimbursement cancelled",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    409: standardErrorResponses[409],
    500: standardErrorResponses[500],
  },
});
