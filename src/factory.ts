import { OpenAPIHono, type RouteConfig, type RouteHook } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { TokenPayload } from "./lib/jwt";
import { err } from "./lib/response";

export type AppEnv = {
  Variables: {
    user: TokenPayload;
  };
};

export type AppContext = Context<AppEnv>;

const defaultHook: RouteHook<RouteConfig, AppEnv> = (result, c) => {
  if (!result.success) {
    return c.json(
      err(
        "VALIDATION_ERROR",
        result.error.issues[0]?.message ?? `Invalid ${result.target} payload`,
      ),
      422,
    );
  }
};

export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook,
  });
}
