import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { finDuesConfig, finMemberDues, members } from "../../db/schema";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import {
  DuesServiceError,
  exemptDues,
  payDues,
  upsertDuesConfig,
  verifyDues,
} from "./dues.service";
import {
  exemptDuesRoute,
  getDuesConfigRoute,
  listDuesRoute,
  myDuesRoute,
  payDuesRoute,
  upsertDuesConfigRoute,
  verifyDuesRoute,
} from "./dues.routes";

function toDuesRecordResponse(record: {
  id: string;
  month: number;
  year: number;
  amount: string;
  status: "unpaid" | "pending" | "verified" | "exempt";
  paymentMethod?: "bni" | "gopay" | "cash" | null;
  receiptUrl?: string | null;
  paidAt?: Date | null;
  verifiedAt?: Date | null;
  exemptReason?: string | null;
  member?: { id: string | null; name: string | null; nim: string | null } | null;
  verifiedBy?: string | null;
}) {
  return {
    id: record.id,
    month: record.month,
    year: record.year,
    amount: record.amount,
    status: record.status,
    payment_method: record.paymentMethod ?? null,
    receipt_url: record.receiptUrl ?? null,
    paid_at: record.paidAt ?? null,
    verified_at: record.verifiedAt ?? null,
    exempt_reason: record.exemptReason ?? null,
    member: record.member,
    verified_by: record.verifiedBy ?? null,
  };
}

function toDuesConfigResponse(config: {
  id: string;
  staffPeriodId: string;
  memberId: string;
  monthlyAmount: string;
  leniencyType: "none" | "reduced_fixed" | "reduced_temporary";
  leniencyStart: string | null;
  leniencyEnd: string | null;
  notes: string | null;
  configuredBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: config.id,
    staff_period_id: config.staffPeriodId,
    member_id: config.memberId,
    monthly_amount: config.monthlyAmount,
    leniency_type: config.leniencyType,
    leniency_start: config.leniencyStart,
    leniency_end: config.leniencyEnd,
    notes: config.notes,
    configured_by: config.configuredBy,
    updated_by: config.updatedBy,
    created_at: config.createdAt,
    updated_at: config.updatedAt,
  };
}

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

  return c.json(ok(rows.map(toDuesRecordResponse)), 200);
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

  return c.json(ok(rows.map(toDuesRecordResponse)), 200);
};

export const payDuesHandler: AppRouteHandler<typeof payDuesRoute> = async (c) => {
  const user = c.get("user");
  const { month, year, payment_method, receipt_url } = c.req.valid("json");

  let created;
  try {
    created = await payDues(db, {
      memberId: user.memberId,
      month,
      year,
      paymentMethod: payment_method,
      receiptUrl: receipt_url,
    });
  } catch (error) {
    if (error instanceof DuesServiceError) {
      if (error.code === "CONFLICT") {
        return c.json(err(error.code, error.message), 409);
      }
      return c.json(err(error.code, error.message), 500);
    }
    throw error;
  }

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

  try {
    await verifyDues(db, id, user.memberId);
  } catch (error) {
    if (error instanceof DuesServiceError) {
      if (error.code === "NOT_FOUND") {
        return c.json(err(error.code, error.message), 404);
      }
      if (error.code === "CONFLICT") {
        return c.json(err(error.code, error.message), 409);
      }
      return c.json(err(error.code, error.message), 500);
    }
    throw error;
  }

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

  let updated;
  try {
    updated = await exemptDues(db, id, user.memberId, exempt_reason);
  } catch (error) {
    if (error instanceof DuesServiceError) {
      if (error.code === "NOT_FOUND") {
        return c.json(err(error.code, error.message), 404);
      }
      if (error.code === "CONFLICT") {
        return c.json(err(error.code, error.message), 409);
      }
      return c.json(err(error.code, error.message), 500);
    }
    throw error;
  }

  return c.json(ok(toDuesRecordResponse(updated)), 200);
};

export const getDuesConfigHandler: AppRouteHandler<typeof getDuesConfigRoute> = async (c) => {
  const { member_id } = c.req.valid("param");
  const rows = await db.select().from(finDuesConfig).where(eq(finDuesConfig.memberId, member_id));
  return c.json(ok(rows.map(toDuesConfigResponse)), 200);
};

export const upsertDuesConfigHandler: AppRouteHandler<typeof upsertDuesConfigRoute> = async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

  const config = await upsertDuesConfig(
    db,
    {
      memberId: data.member_id,
      staffPeriodId: data.staff_period_id,
      monthlyAmount: data.monthly_amount,
      leniencyType: data.leniency_type,
      leniencyStart: data.leniency_start ?? null,
      leniencyEnd: data.leniency_end ?? null,
      notes: data.notes ?? null,
    },
    user.memberId,
  );

  return c.json(ok(toDuesConfigResponse(config)), 201);
};
