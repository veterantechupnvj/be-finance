import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  createProgramRequestSchema,
  programPathSchema,
  programResponseSchema,
  programsListQuerySchema,
  programsResponseSchema,
  updateProgramRequestSchema,
} from "./programs.schema";

const financeOnly = [requireAuth, requireRole("finance")];

export const listProgramsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Programs"],
  summary: "List programs",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    query: programsListQuerySchema,
  },
  responses: {
    200: {
      content: jsonContent(programsResponseSchema),
      description: "Programs",
    },
    401: standardErrorResponses[401],
  },
});

export const getProgramRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Programs"],
  summary: "Get a program by ID",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    params: programPathSchema,
  },
  responses: {
    200: {
      content: jsonContent(programResponseSchema),
      description: "Program detail",
    },
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
  },
});

export const createProgramRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Programs"],
  summary: "Create a program",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(createProgramRequestSchema),
      required: true,
    },
  },
  responses: {
    201: {
      content: jsonContent(programResponseSchema),
      description: "Program created",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});

export const updateProgramRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["Programs"],
  summary: "Update a program",
  middleware: financeOnly,
  security: bearerSecurity,
  request: {
    params: programPathSchema,
    body: {
      content: jsonContent(updateProgramRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(programResponseSchema),
      description: "Program updated",
    },
    401: standardErrorResponses[401],
    403: standardErrorResponses[403],
    404: standardErrorResponses[404],
    422: standardErrorResponses[422],
    500: standardErrorResponses[500],
  },
});
