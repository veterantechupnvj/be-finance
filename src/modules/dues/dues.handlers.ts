import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  finCashflowEntries,
  finCategories,
  finDuesConfig,
  finMemberDues,
  members,
} from "../../db/schema";
import { writeAudit, writeAuditTx } from "../../lib/audit";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import {
  exemptDuesRoute,
  getDuesConfigRoute,
  listDuesRoute,
  myDuesRoute,
  payDuesRoute,
  upsertDuesConfigRoute,
  verifyDuesRoute,
} from "./dues.routes";

const DEFAULT_DUES_AMOUNT = "15000";

export const listDuesHandler: AppRouteHandler<typeof listDuesRoute> = async (c) => {
  const query = c.req.valid("query");

  const conditions: SQL[] = [isNull(finMemberDues.deletedAt)];
  if (query.month) {
    conditions.push(eq(finMemberDues.month, query.month));
  }
  if (query.year) {
    conditions.push(eq(finMemberDues.year, query.year));
  }
  if (query.status) {
    conditions.push(eq(finMemberDues.status, query.status));
  }
  if (query.member_id) {
    conditions.push(eq(finMemberDues.memberId, query.member_id));
  }

  const rows = await db
    .select({
      id: finMemberDues.id,
      month: finMemberDues.month,
      year: finMemberDues.year,
      amount: finMemberDues.amount,
      status: finMemberDues.status,
      paymentMethod: finMemberDues.paymentMethod,
      receiptUrl: finMemberDues.receiptUrl,
      paidAt: finMemberDues.paidAt,
      verifiedAt: finMemberDues.verifiedAt,
      exemptReason: finMemberDues.exemptReason,
      member: {
        id: members.id,
        name: members.name,
        nim: members.nim,
      },
      verifiedBy: finMemberDues.verifiedBy,
    })
    .from(finMemberDues)
    .leftJoin(members, eq(finMemberDues.memberId, members.id))
    .where(and(...conditions))
    .orderBy(finMemberDues.year, finMemberDues.month, members.name);

  return c.json(ok(rows), 200);
};

export const myDuesHandler: AppRouteHandler<typeof myDuesRoute> = async (c) => {
  const user = c.get("user");
  const { year } = c.req.valid("query");
  const selectedYear = year ?? new Date().getFullYear();

  const rows = await db
    .select({
      id: finMemberDues.id,
      month: finMemberDues.month,
      year: finMemberDues.year,
      amount: finMemberDues.amount,
      status: finMemberDues.status,
      paymentMethod: finMemberDues.paymentMethod,
      receiptUrl: finMemberDues.receiptUrl,
      paidAt: finMemberDues.paidAt,
      exemptReason: finMemberDues.exemptReason,
    })
    .from(finMemberDues)
    .where(
      and(
        eq(finMemberDues.memberId, user.memberId),
        eq(finMemberDues.year, selectedYear),
        isNull(finMemberDues.deletedAt),
      ),
    )
    .orderBy(finMemberDues.month);

  return c.json(ok(rows), 200);
};

export const payDuesHandler: AppRouteHandler<typeof payDuesRoute> = async (c) => {
  const user = c.get("user");
  const { month, year, payment_method, receipt_url } = c.req.valid("json");

  const [existing] = await db
    .select({ id: finMemberDues.id, status: finMemberDues.status })
    .from(finMemberDues)
    .where(
      and(
        eq(finMemberDues.memberId, user.memberId),
        eq(finMemberDues.month, month),
        eq(finMemberDues.year, year),
        isNull(finMemberDues.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "verified" || existing.status === "exempt") {
      return c.json(err("CONFLICT", "Dues for this month are already settled"), 409);
    }
    if (existing.status === "pending") {
      return c.json(err("CONFLICT", "Payment already submitted and awaiting verification"), 409);
    }
  }

  const [config] = await db
    .select({ monthlyAmount: finDuesConfig.monthlyAmount })
    .from(finDuesConfig)
    .where(eq(finDuesConfig.memberId, user.memberId))
    .limit(1);

  const amount = config?.monthlyAmount ?? DEFAULT_DUES_AMOUNT;

  const [created] = await db
    .insert(finMemberDues)
    .values({
      memberId: user.memberId,
      month,
      year,
      amount,
      status: "pending",
      paymentMethod: payment_method,
      receiptUrl: receipt_url,
      paidAt: new Date(),
      createdBy: user.memberId,
    })
    .returning();

  if (!created) {
    return c.json(err("INTERNAL_ERROR", "Failed to submit dues payment"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_member_dues",
    entityId: created.id,
    action: "dues_submitted",
    after: created,
  });

  return c.json(
    ok({
      id: created.id,
      month: created.month,
      year: created.year,
      status: created.status,
      message: "Payment submitted. Awaiting finance verification.",
    }),
    201,
  );
};

export const verifyDuesHandler: AppRouteHandler<typeof verifyDuesRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  const [due] = await db
    .select()
    .from(finMemberDues)
    .where(and(eq(finMemberDues.id, id), isNull(finMemberDues.deletedAt)))
    .limit(1);

  if (!due) {
    return c.json(err("NOT_FOUND", "Dues record not found"), 404);
  }
  if (due.status !== "pending") {
    return c.json(err("CONFLICT", `Cannot verify dues with status: ${due.status}`), 409);
  }

  const [category] = await db
    .select({ id: finCategories.id })
    .from(finCategories)
    .where(eq(finCategories.name, "MemberDues"))
    .limit(1);

  if (!category) {
    return c.json(err("INTERNAL_ERROR", "MemberDues category not found - check seed data"), 500);
  }

  await db.transaction(async (tx) => {
    const [cashflowEntry] = await tx
      .insert(finCashflowEntries)
      .values({
        type: "income",
        entryKind: "normal",
        categoryId: category.id,
        description: `Member dues ${due.year}-${String(due.month).padStart(2, "0")}`,
        amount: due.amount,
        paymentMethod: due.paymentMethod!,
        receiptUrl: due.receiptUrl,
        sourceId: due.id,
        recordedBy: user.memberId,
        date: new Date().toISOString().split("T")[0],
      })
      .returning();

    if (!cashflowEntry) {
      throw new Error("Failed to create cashflow entry for dues verification");
    }

    await tx
      .update(finMemberDues)
      .set({
        status: "verified",
        verifiedBy: user.memberId,
        verifiedAt: new Date(),
        cashflowEntryId: cashflowEntry.id,
        updatedBy: user.memberId,
      })
      .where(eq(finMemberDues.id, id));

    await writeAuditTx(tx, {
      actorId: user.memberId,
      entityType: "fin_member_dues",
      entityId: id,
      action: "dues_verified",
      before: due,
      after: { ...due, status: "verified", cashflowEntryId: cashflowEntry.id },
    });
  });

  return c.json(
    ok({
      id,
      status: "verified" as const,
      message: "Dues verified and cashflow entry created",
    }),
    200,
  );
};

export const exemptDuesHandler: AppRouteHandler<typeof exemptDuesRoute> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const { exempt_reason } = c.req.valid("json");

  const [due] = await db
    .select()
    .from(finMemberDues)
    .where(and(eq(finMemberDues.id, id), isNull(finMemberDues.deletedAt)))
    .limit(1);

  if (!due) {
    return c.json(err("NOT_FOUND", "Dues record not found"), 404);
  }

  const [updated] = await db
    .update(finMemberDues)
    .set({
      status: "exempt",
      exemptReason: exempt_reason,
      amount: "0",
      updatedBy: user.memberId,
    })
    .where(eq(finMemberDues.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to exempt dues record"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_member_dues",
    entityId: id,
    action: "dues_exempted",
    before: due,
    after: updated,
    reason: exempt_reason,
  });

  return c.json(ok(updated), 200);
};

export const getDuesConfigHandler: AppRouteHandler<typeof getDuesConfigRoute> = async (c) => {
  const { member_id } = c.req.valid("param");
  const rows = await db.select().from(finDuesConfig).where(eq(finDuesConfig.memberId, member_id));
  return c.json(ok(rows), 200);
};

export const upsertDuesConfigHandler: AppRouteHandler<typeof upsertDuesConfigRoute> = async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

  const [config] = await db
    .insert(finDuesConfig)
    .values({
      memberId: data.member_id,
      staffPeriodId: data.staff_period_id,
      monthlyAmount: String(data.monthly_amount),
      leniencyType: data.leniency_type,
      leniencyStart: data.leniency_start ?? null,
      leniencyEnd: data.leniency_end ?? null,
      notes: data.notes ?? null,
      configuredBy: user.memberId,
    })
    .onConflictDoUpdate({
      target: [finDuesConfig.memberId, finDuesConfig.staffPeriodId],
      set: {
        monthlyAmount: String(data.monthly_amount),
        leniencyType: data.leniency_type,
        leniencyStart: data.leniency_start ?? null,
        leniencyEnd: data.leniency_end ?? null,
        notes: data.notes ?? null,
        updatedBy: user.memberId,
      },
    })
    .returning();

  if (!config) {
    return c.json(err("INTERNAL_ERROR", "Failed to save dues config"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_dues_config",
    entityId: config.id,
    action: "updated",
    after: config,
  });

  return c.json(ok(config), 201);
};
