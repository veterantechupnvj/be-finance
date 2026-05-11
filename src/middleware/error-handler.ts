import type { Context } from "hono";
import { err } from "../lib/response";

export function globalErrorHandler(error: Error, c: Context) {
  console.error("[unhandled]", error);

  // Drizzle / pg unique constraint violation
  if (error.message?.includes("unique constraint")) {
    return c.json(err("CONFLICT", "Resource already exists"), 409);
  }

  // Drizzle / pg foreign key violation
  if (error.message?.includes("foreign key constraint")) {
    return c.json(err("BAD_REQUEST", "Referenced resource does not exist"), 400);
  }

  return c.json(err("INTERNAL_ERROR", "Something went wrong"), 500);
}
