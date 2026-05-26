import { createRoute, z } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authModule from "./modules/auth";
import cashflowModule from "./modules/cashflow";
import categoriesModule from "./modules/categories";
import duesModule from "./modules/dues";
import membersModule from "./modules/members";
import merchModule from "./modules/merch";
import programsModule from "./modules/programs";
import refModule from "./modules/ref";
import reimbursementsModule from "./modules/reimbursements";
import { createRouter, type AppEnv } from "./factory";
import { globalErrorHandler } from "./middleware/error-handler";
import { ok } from "./lib/response";
import { jsonContent } from "./lib/openapi";

const app = createRouter();
app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

app.use("*", logger());
app.use("*", cors());

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Health check",
  responses: {
    200: {
      content: jsonContent(
        z.object({
          success: z.literal(true),
          data: z.object({
            status: z.literal("ok"),
          }),
        }),
      ),
      description: "Healthy",
    },
  },
});

const openApiRoute = createRoute({
  method: "get",
  path: "/api/openapi.json",
  tags: ["System"],
  summary: "OpenAPI document",
  hide: true,
  responses: {
    200: {
      content: jsonContent(z.any()),
      description: "OpenAPI JSON",
    },
  },
});

const referenceRoute = createRoute({
  method: "get",
  path: "/reference",
  tags: ["System"],
  summary: "Scalar API reference",
  hide: true,
  responses: {
    200: {
      content: {
        "text/html": {
          schema: z.string(),
        },
      },
      description: "Scalar reference UI",
    },
  },
});

app.openapi(healthRoute, async (c) => c.json(ok({ status: "ok" }), 200));

app.route("/auth", authModule);
app.route("/members", membersModule);
app.route("/ref", refModule);
app.route("/finance/categories", categoriesModule);
app.route("/finance/cashflow", cashflowModule);
app.route("/finance/dues", duesModule);
app.route("/finance/merch", merchModule);
app.route("/finance/programs", programsModule);
app.route("/finance/reimbursements", reimbursementsModule);

app.openapi(openApiRoute, async (c) =>
  c.json(
    app.getOpenAPIDocument({
      openapi: "3.0.0",
      info: {
        title: "VeteranTech Finance Dashboard API",
        version: "1.0.0",
      },
    }),
    200,
  ),
);

app.openapi(referenceRoute, async (c) => {
  const handler = apiReference<AppEnv>({
    pageTitle: "VeteranTech Finance API Reference",
    url: "/api/openapi.json",
  });

  const response = await handler(c, async () => {});
  return response ?? c.html("");
});

app.onError(globalErrorHandler);

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404,
  );
});

export default app;
