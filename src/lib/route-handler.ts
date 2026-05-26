import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../factory";

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppEnv>;
