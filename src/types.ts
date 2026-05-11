import type { TokenPayload } from "./lib/jwt";

declare module "hono" {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}
