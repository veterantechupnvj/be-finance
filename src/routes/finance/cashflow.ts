// src/routes/finance/cashflow.ts
import { Hono } from "hono";
import { eq, and, gte, lte, isNull, sql, SQL, sum, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { finCashflowEntries, finCategories, programs, members } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { ok, err } from "../../lib/response";
import { writeAudit } from "../../lib/audit";
import type { TokenPayload } from "../../lib/jwt";

const router = new Hono();

// ============================================================
// VALIDATION
// ============================================================

const createSchema = z.object({
  type: z.enum(["income", "expense"]),
  entry_kind: z.enum(["normal", "opening_balance", "adjustment"]).default("normal"),
  category_id: z.string().uuid(),
  program_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1),
  amount: z.number().positive(),
  payment_method: z.enum(["bni", "gopay", "cash"]),
  receipt_url: z.string().url().nullable().optional(),
  date: z.string().date(),
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

// ============================================================
// GET /finance/cashflow
// [member] — ledger list with filters + pagination
// ============================================================

router.get("/", requireAuth, async (c) => {
  const user = c.get("user") as TokenPayload;
  const isFinance = user.roles.includes("finance");

  const page = Number(c.req.query("page") ?? 1);
  const perPage = Math.min(Number(c.req.query("per_page") ?? 20), 100);
  const type = c.req.query("type");
  const entryKind = c.req.query("entry_kind");
  const categoryId = c.req.query("category_id");
  const programId = c.req.query("program_id");
  const paymentMethod = c.req.query("payment_method");
  const dateFrom = c.req.query("date_from");
  const dateTo = c.req.query("date_to");
  const includeDeleted = isFinance && c.req.query("include_deleted") === "true";

  const conditions: SQL[] = [];
  if (!includeDeleted) conditions.push(isNull(finCashflowEntries.deletedAt));
  if (type) conditions.push(eq(finCashflowEntries.type, type as any));
  if (entryKind) conditions.push(eq(finCashflowEntries.entryKind, entryKind as any));
  if (categoryId) conditions.push(eq(finCashflowEntries.categoryId, categoryId));
  if (programId) conditions.push(eq(finCashflowEntries.programId, programId));
  if (paymentMethod) conditions.push(eq(finCashflowEntries.paymentMethod, paymentMethod as any));
  if (dateFrom) conditions.push(gte(finCashflowEntries.date, dateFrom));
  if (dateTo) conditions.push(lte(finCashflowEntries.date, dateTo));

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: finCashflowEntries.id,
        type: finCashflowEntries.type,
        entryKind: finCashflowEntries.entryKind,
        description: finCashflowEntries.description,
        amount: finCashflowEntries.amount,
        paymentMethod: finCashflowEntries.paymentMethod,
        receiptUrl: finCashflowEntries.receiptUrl,
        date: finCashflowEntries.date,
        notes: finCashflowEntries.notes,
        createdAt: finCashflowEntries.createdAt,
        deletedAt: finCashflowEntries.deletedAt,
        category: {
          id: finCategories.id,
          name: finCategories.name,
        },
        program: {
          id: programs.id,
          name: programs.name,
        },
        recordedBy: {
          id: members.id,
          name: members.name,
        },
      })
      .from(finCashflowEntries)
      .leftJoin(finCategories, eq(finCashflowEntries.categoryId, finCategories.id))
      .leftJoin(programs, eq(finCashflowEntries.programId, programs.id))
      .leftJoin(members, eq(finCashflowEntries.recordedBy, members.id))
      .where(where)
      .orderBy(desc(finCashflowEntries.date), desc(finCashflowEntries.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.$count(finCashflowEntries, where),
  ]);

  const total = Number(countResult);

  return c.json({
    success: true,
    data: rows,
    meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
  });
});

// ============================================================
// GET /finance/cashflow/summary
// [member] — aggregated data for transparency dashboard charts
// ============================================================

router.get("/summary", requireAuth, async (c) => {
  const year = Number(c.req.query("year") ?? new Date().getFullYear());
  const month = c.req.query("month") ? Number(c.req.query("month")) : undefined;

  const baseConditions: SQL[] = [
    isNull(finCashflowEntries.deletedAt),
    gte(finCashflowEntries.date, `${year}-01-01`),
    lte(finCashflowEntries.date, `${year}-12-31`),
  ];

  // Total income & expense
  const totals = await db
    .select({
      type: finCashflowEntries.type,
      total: sum(finCashflowEntries.amount),
    })
    .from(finCashflowEntries)
    .where(and(...baseConditions))
    .groupBy(finCashflowEntries.type);

  const totalIncome = Number(totals.find((t) => t.type === "income")?.total ?? 0);
  const totalExpense = Number(totals.find((t) => t.type === "expense")?.total ?? 0);

  // Balance by payment method (derived — no stored table)
  const balanceByMethod = await db
    .select({
      paymentMethod: finCashflowEntries.paymentMethod,
      balance: sql<string>`
        SUM(CASE WHEN ${finCashflowEntries.type} = 'income'
            THEN ${finCashflowEntries.amount}
            ELSE -${finCashflowEntries.amount}
        END)
      `,
    })
    .from(finCashflowEntries)
    .where(isNull(finCashflowEntries.deletedAt))
    .groupBy(finCashflowEntries.paymentMethod);

  // Income breakdown by category
  const incomeByCategory = await db
    .select({
      category: finCategories.name,
      amount: sum(finCashflowEntries.amount),
    })
    .from(finCashflowEntries)
    .leftJoin(finCategories, eq(finCashflowEntries.categoryId, finCategories.id))
    .where(and(...baseConditions, eq(finCashflowEntries.type, "income")))
    .groupBy(finCategories.name)
    .orderBy(desc(sum(finCashflowEntries.amount)));

  // Expense breakdown by category
  const expenseByCategory = await db
    .select({
      category: finCategories.name,
      amount: sum(finCashflowEntries.amount),
    })
    .from(finCashflowEntries)
    .leftJoin(finCategories, eq(finCashflowEntries.categoryId, finCategories.id))
    .where(and(...baseConditions, eq(finCashflowEntries.type, "expense")))
    .groupBy(finCategories.name)
    .orderBy(desc(sum(finCashflowEntries.amount)));

  // Monthly timeline for the year
  const timeline = await db
    .select({
      month: sql<string>`TO_CHAR(${finCashflowEntries.date}, 'YYYY-MM')`,
      type: finCashflowEntries.type,
      total: sum(finCashflowEntries.amount),
    })
    .from(finCashflowEntries)
    .where(and(...baseConditions))
    .groupBy(sql`TO_CHAR(${finCashflowEntries.date}, 'YYYY-MM')`, finCashflowEntries.type)
    .orderBy(sql`TO_CHAR(${finCashflowEntries.date}, 'YYYY-MM')`);

  // Reshape timeline into { period, income, expense }
  const timelineMap: Record<string, { period: string; income: number; expense: number }> = {};
  for (const row of timeline) {
    if (!timelineMap[row.month]) {
      timelineMap[row.month] = { period: row.month, income: 0, expense: 0 };
    }
    timelineMap[row.month][row.type as "income" | "expense"] = Number(row.total ?? 0);
  }

  return c.json(
    ok({
      total_income: totalIncome,
      total_expense: totalExpense,
      net: totalIncome - totalExpense,
      balance_by_method: Object.fromEntries(
        balanceByMethod.map((b) => [b.paymentMethod, Number(b.balance ?? 0)]),
      ),
      income_by_category: incomeByCategory.map((r) => ({
        category: r.category,
        amount: Number(r.amount ?? 0),
      })),
      expense_by_category: expenseByCategory.map((r) => ({
        category: r.category,
        amount: Number(r.amount ?? 0),
      })),
      timeline: Object.values(timelineMap),
    }),
  );
});

// ============================================================
// POST /finance/cashflow
// [finance] — manually record a cashflow entry
// ============================================================

router.post("/", requireAuth, requireRole("finance"), async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const data = parsed.data;

  const [created] = await db
    .insert(finCashflowEntries)
    .values({
      type: data.type,
      entryKind: data.entry_kind,
      categoryId: data.category_id,
      programId: data.program_id ?? null,
      description: data.description,
      amount: String(data.amount),
      paymentMethod: data.payment_method,
      receiptUrl: data.receipt_url ?? null,
      date: data.date,
      notes: data.notes ?? null,
      recordedBy: user.memberId,
    })
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_cashflow_entries",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
});

// ============================================================
// PATCH /finance/cashflow/:id
// [finance] — edit an entry, writes audit before/after
// ============================================================

router.patch("/:id", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [existing] = await db
    .select()
    .from(finCashflowEntries)
    .where(and(eq(finCashflowEntries.id, id), isNull(finCashflowEntries.deletedAt)))
    .limit(1);

  if (!existing) return c.json(err("NOT_FOUND", "Cashflow entry not found"), 404);

  const data = parsed.data;
  const updates: Partial<typeof finCashflowEntries.$inferInsert> = {
    updatedBy: user.memberId,
  };
  if (data.type) updates.type = data.type;
  if (data.entry_kind) updates.entryKind = data.entry_kind;
  if (data.category_id) updates.categoryId = data.category_id;
  if (data.program_id !== undefined) updates.programId = data.program_id ?? null;
  if (data.description) updates.description = data.description;
  if (data.amount) updates.amount = String(data.amount);
  if (data.payment_method) updates.paymentMethod = data.payment_method;
  if (data.receipt_url !== undefined) updates.receiptUrl = data.receipt_url ?? null;
  if (data.date) updates.date = data.date;
  if (data.notes !== undefined) updates.notes = data.notes ?? null;

  const [updated] = await db
    .update(finCashflowEntries)
    .set(updates)
    .where(eq(finCashflowEntries.id, id))
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_cashflow_entries",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated));
});

// ============================================================
// DELETE /finance/cashflow/:id
// [finance] — soft delete, reason required
// ============================================================

router.delete("/:id", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const body = z
    .object({ reason: z.string().min(1, "Reason is required") })
    .safeParse(await c.req.json().catch(() => ({})));

  if (!body.success) {
    return c.json(err("VALIDATION_ERROR", "A reason is required to delete an entry"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [existing] = await db
    .select()
    .from(finCashflowEntries)
    .where(and(eq(finCashflowEntries.id, id), isNull(finCashflowEntries.deletedAt)))
    .limit(1);

  if (!existing) return c.json(err("NOT_FOUND", "Cashflow entry not found"), 404);

  await db.transaction(async (tx) => {
    await tx
      .update(finCashflowEntries)
      .set({
        deletedAt: new Date(),
        deletedBy: user.memberId,
        deleteReason: body.data.reason,
      })
      .where(eq(finCashflowEntries.id, id));

    await writeAudit({
      actorId: user.memberId,
      entityType: "fin_cashflow_entries",
      entityId: id,
      action: "deleted",
      before: existing,
      reason: body.data.reason,
    });
  });

  return c.json(ok({ message: "Entry deleted" }));
});

export default router;
