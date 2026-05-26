import { and, desc, eq, gte, isNull, lte, sql, sum, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { finCashflowEntries, finCategories, members, programs } from "../../db/schema";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import {
  CashflowServiceError,
  createCashflow,
  deleteCashflow,
  updateCashflow,
} from "./cashflow.service";
import {
  cashflowSummaryRoute,
  createCashflowRoute,
  deleteCashflowRoute,
  listCashflowRoute,
  updateCashflowRoute,
} from "./cashflow.routes";

function toCashflowResponse(entry: {
  id: string;
  type: "income" | "expense";
  entryKind: "normal" | "opening_balance" | "adjustment";
  categoryId: string;
  programId: string | null;
  description: string;
  amount: string;
  paymentMethod: "bni" | "gopay" | "cash";
  receiptUrl: string | null;
  sourceId?: string | null;
  recordedBy: string;
  updatedBy?: string | null;
  deletedBy?: string | null;
  date: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deleteReason?: string | null;
}) {
  return {
    id: entry.id,
    type: entry.type,
    entry_kind: entry.entryKind,
    category_id: entry.categoryId,
    program_id: entry.programId,
    description: entry.description,
    amount: entry.amount,
    payment_method: entry.paymentMethod,
    receipt_url: entry.receiptUrl,
    source_id: entry.sourceId ?? null,
    recorded_by: entry.recordedBy,
    updated_by: entry.updatedBy ?? null,
    deleted_by: entry.deletedBy ?? null,
    date: entry.date,
    notes: entry.notes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt ?? null,
    delete_reason: entry.deleteReason ?? null,
  };
}

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
        entry_kind: finCashflowEntries.entryKind,
        description: finCashflowEntries.description,
        amount: finCashflowEntries.amount,
        payment_method: finCashflowEntries.paymentMethod,
        receipt_url: finCashflowEntries.receiptUrl,
        date: finCashflowEntries.date,
        notes: finCashflowEntries.notes,
        created_at: finCashflowEntries.createdAt,
        deleted_at: finCashflowEntries.deletedAt,
        category: {
          id: finCategories.id,
          name: finCategories.name,
        },
        program: {
          id: programs.id,
          name: programs.name,
        },
        recorded_by: {
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
      ...ok(rows),
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
  const { month, year } = c.req.valid("query");
  const selectedYear = year ?? new Date().getFullYear();

  const baseConditions: SQL[] = [
    isNull(finCashflowEntries.deletedAt),
    gte(finCashflowEntries.date, `${selectedYear}-01-01`),
    lte(finCashflowEntries.date, `${selectedYear}-12-31`),
  ];
  if (month !== undefined) {
    const monthStart = `${selectedYear}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = new Date(Date.UTC(selectedYear, month, 0)).toISOString().slice(0, 10);
    baseConditions.push(gte(finCashflowEntries.date, monthStart));
    baseConditions.push(lte(finCashflowEntries.date, monthEnd));
  }

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
    .where(and(...baseConditions))
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

  let created;
  try {
    created = await createCashflow(
      db,
      {
        type: data.type,
        entryKind: data.entry_kind,
        categoryId: data.category_id,
        programId: data.program_id ?? null,
        description: data.description,
        amount: data.amount,
        paymentMethod: data.payment_method,
        receiptUrl: data.receipt_url ?? null,
        date: data.date,
        notes: data.notes ?? null,
      },
      user.memberId,
    );
  } catch (error) {
    if (error instanceof CashflowServiceError) {
      return c.json(err(error.code, error.message), 500);
    }
    throw error;
  }

  return c.json(ok(toCashflowResponse(created)), 201);
};

export const updateCashflowHandler: AppRouteHandler<typeof updateCashflowRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  let updated;
  try {
    updated = await updateCashflow(
      db,
      id,
      {
        type: data.type,
        entryKind: data.entry_kind,
        categoryId: data.category_id,
        programId: data.program_id,
        description: data.description,
        amount: data.amount,
        paymentMethod: data.payment_method,
        receiptUrl: data.receipt_url,
        date: data.date,
        notes: data.notes,
      },
      user.memberId,
    );
  } catch (error) {
    if (error instanceof CashflowServiceError) {
      return c.json(err(error.code, error.message), 404);
    }
    throw error;
  }

  return c.json(ok(toCashflowResponse(updated)), 200);
};

export const deleteCashflowHandler: AppRouteHandler<typeof deleteCashflowRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const { reason } = c.req.valid("json");

  try {
    await deleteCashflow(db, id, user.memberId, reason);
  } catch (error) {
    if (error instanceof CashflowServiceError) {
      return c.json(err(error.code, error.message), 404);
    }
    throw error;
  }

  return c.json(ok({ message: "Entry deleted" }), 200);
};
