import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import { bearerSecurity, jsonContent, standardErrorResponses } from "../../lib/openapi";
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  loginResponseSchema,
  meResponseSchema,
  messageResponseSchema,
} from "./auth.schema";

export const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  summary: "Login with NIM and password",
  request: {
    body: {
      content: jsonContent(loginRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(loginResponseSchema),
      description: "Authenticated",
    },
    401: standardErrorResponses[401],
    422: standardErrorResponses[422],
  },
});

export const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Get the current authenticated member",
  middleware: requireAuth,
  security: bearerSecurity,
  responses: {
    200: {
      content: jsonContent(meResponseSchema),
      description: "Current member profile",
    },
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
  },
});

export const changePasswordRoute = createRoute({
  method: "post",
  path: "/change-password",
  tags: ["Auth"],
  summary: "Change the current user's password",
  middleware: requireAuth,
  security: bearerSecurity,
  request: {
    body: {
      content: jsonContent(changePasswordRequestSchema),
      required: true,
    },
  },
  responses: {
    200: {
      content: jsonContent(messageResponseSchema),
      description: "Password updated",
    },
    401: standardErrorResponses[401],
    404: standardErrorResponses[404],
    422: standardErrorResponses[422],
  },
});

export const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Auth"],
  summary: "Log out the current user",
  middleware: requireAuth,
  security: bearerSecurity,
  responses: {
    200: {
      content: jsonContent(messageResponseSchema),
      description: "Logout acknowledged",
    },
    401: standardErrorResponses[401],
  },
});
