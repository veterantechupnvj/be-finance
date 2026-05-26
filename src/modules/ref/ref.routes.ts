import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  activeStaffPeriodResponseSchema,
  divisionsResponseSchema,
  staffPeriodsResponseSchema,
} from "./ref.schema";

export const listDivisionsRoute = createRoute({
  method: "get",
  path: "/divisions",
  tags: ["Members"],
  summary: "List active divisions",
  middleware: requireAuth,
  security: bearerSecurity,
  responses: {
    200: {
      content: jsonContent(divisionsResponseSchema),
      description: "Divisions",
    },
    401: standardErrorResponses[401],
  },
});

export const listStaffPeriodsRoute = createRoute({
  method: "get",
  path: "/staff-periods",
  tags: ["Members"],
  summary: "List staff periods",
  middleware: requireAuth,
  security: bearerSecurity,
  responses: {
    200: {
      content: jsonContent(staffPeriodsResponseSchema),
      description: "Staff periods",
    },
    401: standardErrorResponses[401],
  },
});

export const getActiveStaffPeriodRoute = createRoute({
  method: "get",
  path: "/staff-periods/active",
  tags: ["Members"],
  summary: "Get the active staff period",
  middleware: requireAuth,
  security: bearerSecurity,
  responses: {
    200: {
      content: jsonContent(activeStaffPeriodResponseSchema),
      description: "Active staff period",
    },
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
  },
});
