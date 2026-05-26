import { and, desc, eq, gte, isNull, lte, sql, sum, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { finCashflowEntries, finCategories, members, programs } from "../../db/schema";
import { writeAudit, writeAuditTx } from "../../lib/audit";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import {
  cashflowSummaryRoute,
  createCashflowRoute,
  deleteCashflowRoute,
  listCashflowRoute,
  updateCashflowRoute,
} from "./cashflow.routes";

export const listCashflowHandler: AppRouteHandler<typeof listCashflowRoute> = async (c) => {
  const user = c.get("user");
  const query = c.req.valid("query");
  const isFinance = user.roles.includes("finance");
  const page = query.page ?? 1;
  const perPage = Math.min(query.per_page ?? 20, 100);
  const includeDeleted = isFinance && query.include_deleted === true;

  const conditions: SQL[] = [];
  if (!includeDeleted) {
    conditions.push(isNull(finCashflowEntries.deletedAt));
  }
  if (query.type) {
    conditions.push(eq(finCashflowEntries.type, query.type));
  }
  if (query.entry_kind) {
    conditions.push(eq(finCashflowEntries.entryKind, query.entry_kind));
  }
  if (query.category_id) {
    conditions.push(eq(finCashflowEntries.categoryId, query.category_id));
  }
  if (query.program_id) {
    conditions.push(eq(finCashflowEntries.programId, query.program_id));
  }
  if (query.payment_method) {
    conditions.push(eq(finCashflowEntries.paymentMethod, query.payment_method));
  }
  if (query.date_from) {
    conditions.push(gte(finCashflowEntries.date, query.date_from));
  }
  if (query.date_to) {
    conditions.push(lte(finCashflowEntries.date, query.date_to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
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

  const count = Number(total);

  return c.json(
    {
      success: true,
      data: rows,
      meta: {
        total: count,
        page,
        per_page: perPage,
        total_pages: Math.ceil(count / perPage),
      },
    },
    200,
  );
};

export const cashflowSummaryHandler: AppRouteHandler<typeof cashflowSummaryRoute> = async (c) => {
  const { year } = c.req.valid("query");
  const selectedYear = year ?? new Date().getFullYear();

  const baseConditions: SQL[] = [
    isNull(finCashflowEntries.deletedAt),
    gte(finCashflowEntries.date, `${selectedYear}-01-01`),
    lte(finCashflowEntries.date, `${selectedYear}-12-31`),
  ];

  const totals = await db
    .select({
      type: finCashflowEntries.type,
      total: sum(finCashflowEntries.amount),
    })
    .from(finCashflowEntries)
    .where(and(...baseConditions))
    .groupBy(finCashflowEntries.type);

  const totalIncome = Number(totals.find((row) => row.type === "income")?.total ?? 0);
  const totalExpense = Number(totals.find((row) => row.type === "expense")?.total ?? 0);

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

  const timelineRows = await db
    .select({
      month: sql<string>`TO_CHAR(${finCashflowEntries.date}, 'YYYY-MM')`,
      type: finCashflowEntries.type,
      total: sum(finCashflowEntries.amount),
    })
    .from(finCashflowEntries)
    .where(and(...baseConditions))
    .groupBy(sql`TO_CHAR(${finCashflowEntries.date}, 'YYYY-MM')`, finCashflowEntries.type)
    .orderBy(sql`TO_CHAR(${finCashflowEntries.date}, 'YYYY-MM')`);

  const timelineMap: Record<string, { period: string; income: number; expense: number }> = {};
  for (const row of timelineRows) {
    if (!timelineMap[row.month]) {
      timelineMap[row.month] = { period: row.month, income: 0, expense: 0 };
    }
    timelineMap[row.month][row.type] = Number(row.total ?? 0);
  }

  return c.json(
    ok({
      total_income: totalIncome,
      total_expense: totalExpense,
      net: totalIncome - totalExpense,
      balance_by_method: Object.fromEntries(
        balanceByMethod.map((row) => [row.paymentMethod, Number(row.balance ?? 0)]),
      ),
      income_by_category: incomeByCategory.map((row) => ({
        category: row.category,
        amount: Number(row.amount ?? 0),
      })),
      expense_by_category: expenseByCategory.map((row) => ({
        category: row.category,
        amount: Number(row.amount ?? 0),
      })),
      timeline: Object.values(timelineMap),
    }),
    200,
  );
};

export const createCashflowHandler: AppRouteHandler<typeof createCashflowRoute> = async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

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

  if (!created) {
    return c.json(err("INTERNAL_ERROR", "Failed to create cashflow entry"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_cashflow_entries",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
};

export const updateCashflowHandler: AppRouteHandler<typeof updateCashflowRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(finCashflowEntries)
    .where(and(eq(finCashflowEntries.id, id), isNull(finCashflowEntries.deletedAt)))
    .limit(1);

  if (!existing) {
    return c.json(err("NOT_FOUND", "Cashflow entry not found"), 404);
  }

  const updates: Partial<typeof finCashflowEntries.$inferInsert> = {
    updatedBy: user.memberId,
  };
  if (data.type !== undefined) {
    updates.type = data.type;
  }
  if (data.entry_kind !== undefined) {
    updates.entryKind = data.entry_kind;
  }
  if (data.category_id !== undefined) {
    updates.categoryId = data.category_id;
  }
  if (data.program_id !== undefined) {
    updates.programId = data.program_id ?? null;
  }
  if (data.description !== undefined) {
    updates.description = data.description;
  }
  if (data.amount !== undefined) {
    updates.amount = String(data.amount);
  }
  if (data.payment_method !== undefined) {
    updates.paymentMethod = data.payment_method;
  }
  if (data.receipt_url !== undefined) {
    updates.receiptUrl = data.receipt_url ?? null;
  }
  if (data.date !== undefined) {
    updates.date = data.date;
  }
  if (data.notes !== undefined) {
    updates.notes = data.notes ?? null;
  }

  const [updated] = await db
    .update(finCashflowEntries)
    .set(updates)
    .where(eq(finCashflowEntries.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to update cashflow entry"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_cashflow_entries",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated), 200);
};

export const deleteCashflowHandler: AppRouteHandler<typeof deleteCashflowRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const { reason } = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(finCashflowEntries)
    .where(and(eq(finCashflowEntries.id, id), isNull(finCashflowEntries.deletedAt)))
    .limit(1);

  if (!existing) {
    return c.json(err("NOT_FOUND", "Cashflow entry not found"), 404);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(finCashflowEntries)
      .set({
        deletedAt: new Date(),
        deletedBy: user.memberId,
        deleteReason: reason,
      })
      .where(eq(finCashflowEntries.id, id));

    await writeAuditTx(tx, {
      actorId: user.memberId,
      entityType: "fin_cashflow_entries",
      entityId: id,
      action: "deleted",
      before: existing,
      reason,
    });
  });

  return c.json(ok({ message: "Entry deleted" }), 200);
};
