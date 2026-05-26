import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  memberDetailResponseSchema,
  memberPathSchema,
  membersListQuerySchema,
  membersListResponseSchema,
} from "./members.schema";

const financeOnly = [requireAuth, requireRole("finance")];

export const listMembersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Members"],
  summary: "List members with filters and pagination",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    query: membersListQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(membersListResponseSchema),
      description: "Member list",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
  },
});

export const getMemberRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Members"],
  summary: "Get a member by ID",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: memberPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(memberDetailResponseSchema),
      description: "Member detail",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
  },
});
