import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { globalErrorHandler } from "./middleware/error-handler";
import "dotenv/config";

import authRoutes from "./routes/auth";
import memberRoutes from "./routes/members";
import refRoutes from "./routes/ref";
import categoryRoutes from "./routes/finance/categories";
import cashflowRoutes from "./routes/finance/cashflow";
import duesRoutes from "./routes/finance/dues";
import merchRoutes from "./routes/finance/merch";
import programRoutes from "./routes/finance/programs";
import reimbursementRoutes from "./routes/finance/reimbursements";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ success: true, data: { status: "ok" } });
});

app.route("/auth", authRoutes);
app.route("/members", memberRoutes);
app.route("/ref", refRoutes);
app.route("/finance/categories", categoryRoutes);
app.route("/finance/cashflow", cashflowRoutes);
app.route("/finance/dues", duesRoutes);
app.route("/finance/merch", merchRoutes);
app.route("/finance/programs", programRoutes);
app.route("/finance/reimbursements", reimbursementRoutes);

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

const port = Number(process.env.PORT) || 3456;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
