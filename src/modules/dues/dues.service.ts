import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db as database } from "../../db";
import {
  finCashflowEntries,
  finCategories,
  finDuesConfig,
  finMemberDues,
  staffPeriods,
} from "../../db/schema";
import { writeAuditTx } from "../../lib/audit";

type DbClient = typeof database;
type DuesServiceErrorCode = "CONFLICT" | "INTERNAL_ERROR" | "NOT_FOUND";

const DEFAULT_DUES_AMOUNT = "15000";

export interface PayDuesPayload {
  memberId: string;
  month: number;
  year: number;
  paymentMethod: "bni" | "gopay" | "cash";
  receiptUrl: string;
}

export interface UpsertDuesConfigPayload {
  memberId: string;
  staffPeriodId: string;
  monthlyAmount: number;
  leniencyType: "none" | "reduced_fixed" | "reduced_temporary";
  leniencyStart: string | null;
  leniencyEnd: string | null;
  notes: string | null;
}

export class DuesServiceError extends Error {
  constructor(
    public readonly code: DuesServiceErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DuesServiceError";
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function paymentMonthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function resolveMonthlyAmount(
  config: {
    monthlyAmount: string;
    leniencyType: "none" | "reduced_fixed" | "reduced_temporary";
    leniencyStart: string | null;
    leniencyEnd: string | null;
  } | null,
  monthStart: string,
): string {
  if (!config) {
    return DEFAULT_DUES_AMOUNT;
  }

  if (config.leniencyType === "reduced_temporary") {
    const startsBeforeOrOn = !config.leniencyStart || config.leniencyStart <= monthStart;
    const endsAfterOrOn = !config.leniencyEnd || config.leniencyEnd >= monthStart;
    return startsBeforeOrOn && endsAfterOrOn ? config.monthlyAmount : DEFAULT_DUES_AMOUNT;
  }

  return config.monthlyAmount;
}

export async function verifyDues(db: DbClient, duesId: string, verifiedBy: string) {
  return db.transaction(async (tx) => {
    const [due] = await tx
      .select()
      .from(finMemberDues)
      .where(and(eq(finMemberDues.id, duesId), isNull(finMemberDues.deletedAt)))
      .limit(1);

    if (!due) {
      throw new DuesServiceError("NOT_FOUND", 404, "Dues record not found");
    }
    if (due.status !== "pending") {
      throw new DuesServiceError("CONFLICT", 409, `Cannot verify dues with status: ${due.status}`);
    }
    if (!due.paymentMethod) {
      throw new DuesServiceError("INTERNAL_ERROR", 500, "Dues payment method is missing");
    }

    const [category] = await tx
      .select({ id: finCategories.id })
      .from(finCategories)
      .where(eq(finCategories.name, "MemberDues"))
      .limit(1);

    if (!category) {
      throw new DuesServiceError(
        "INTERNAL_ERROR",
        500,
        "MemberDues category not found - check seed data",
      );
    }

    const verifiedAt = new Date();
    const [cashflowEntry] = await tx
      .insert(finCashflowEntries)
      .values({
        type: "income",
        entryKind: "normal",
        categoryId: category.id,
        description: `Member dues ${due.year}-${String(due.month).padStart(2, "0")}`,
        amount: due.amount,
        paymentMethod: due.paymentMethod,
        receiptUrl: due.receiptUrl,
        sourceId: due.id,
        recordedBy: verifiedBy,
        date: todayIsoDate(),
      })
      .returning();

    if (!cashflowEntry) {
      throw new Error("Failed to create cashflow entry for dues verification");
    }

    const [updatedDue] = await tx
      .update(finMemberDues)
      .set({
        status: "verified",
        verifiedBy,
        verifiedAt,
        cashflowEntryId: cashflowEntry.id,
        updatedBy: verifiedBy,
      })
      .where(eq(finMemberDues.id, duesId))
      .returning();

    if (!updatedDue) {
      throw new Error("Failed to update dues verification");
    }

    await writeAuditTx(tx, {
      actorId: verifiedBy,
      entityType: "fin_member_dues",
      entityId: duesId,
      action: "dues_verified",
      before: due,
      after: updatedDue,
    });

    return updatedDue;
  });
}

export async function payDues(db: DbClient, payload: PayDuesPayload) {
  return db.transaction(async (tx) => {
    const monthStart = paymentMonthStart(payload.year, payload.month);
    const [existing] = await tx
      .select({
        id: finMemberDues.id,
        status: finMemberDues.status,
        amount: finMemberDues.amount,
        duesConfigId: finMemberDues.duesConfigId,
        paymentMethod: finMemberDues.paymentMethod,
        receiptUrl: finMemberDues.receiptUrl,
        paidAt: finMemberDues.paidAt,
        updatedBy: finMemberDues.updatedBy,
      })
      .from(finMemberDues)
      .where(
        and(
          eq(finMemberDues.memberId, payload.memberId),
          eq(finMemberDues.month, payload.month),
          eq(finMemberDues.year, payload.year),
          isNull(finMemberDues.deletedAt),
        ),
      )
      .limit(1);

    const [config] = await tx
      .select({
        id: finDuesConfig.id,
        monthlyAmount: finDuesConfig.monthlyAmount,
        leniencyType: finDuesConfig.leniencyType,
        leniencyStart: finDuesConfig.leniencyStart,
        leniencyEnd: finDuesConfig.leniencyEnd,
      })
      .from(finDuesConfig)
      .innerJoin(staffPeriods, eq(finDuesConfig.staffPeriodId, staffPeriods.id))
      .where(
        and(
          eq(finDuesConfig.memberId, payload.memberId),
          lte(staffPeriods.startDate, monthStart),
          or(isNull(staffPeriods.endDate), gte(staffPeriods.endDate, monthStart)),
        ),
      )
      .orderBy(desc(staffPeriods.startDate))
      .limit(1);

    const amount = resolveMonthlyAmount(config ?? null, monthStart);

    if (existing) {
      if (existing.status === "verified" || existing.status === "exempt") {
        throw new DuesServiceError("CONFLICT", 409, "Dues for this month are already settled");
      }
      if (existing.status === "pending") {
        throw new DuesServiceError(
          "CONFLICT",
          409,
          "Payment already submitted and awaiting verification",
        );
      }

      const [updated] = await tx
        .update(finMemberDues)
        .set({
          duesConfigId: config?.id ?? null,
          amount,
          status: "pending",
          paymentMethod: payload.paymentMethod,
          receiptUrl: payload.receiptUrl,
          paidAt: new Date(),
          updatedBy: payload.memberId,
        })
        .where(eq(finMemberDues.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to submit dues payment");
      }

      await writeAuditTx(tx, {
        actorId: payload.memberId,
        entityType: "fin_member_dues",
        entityId: updated.id,
        action: "dues_submitted",
        before: existing,
        after: updated,
      });

      return updated;
    }

    const [created] = await tx
      .insert(finMemberDues)
      .values({
        memberId: payload.memberId,
        duesConfigId: config?.id ?? null,
        month: payload.month,
        year: payload.year,
        amount,
        status: "pending",
        paymentMethod: payload.paymentMethod,
        receiptUrl: payload.receiptUrl,
        paidAt: new Date(),
        createdBy: payload.memberId,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to submit dues payment");
    }

    await writeAuditTx(tx, {
      actorId: payload.memberId,
      entityType: "fin_member_dues",
      entityId: created.id,
      action: "dues_submitted",
      after: created,
    });

    return created;
  });
}

export async function exemptDues(db: DbClient, duesId: string, exemptedBy: string, reason: string) {
  return db.transaction(async (tx) => {
    const [due] = await tx
      .select()
      .from(finMemberDues)
      .where(and(eq(finMemberDues.id, duesId), isNull(finMemberDues.deletedAt)))
      .limit(1);

    if (!due) {
      throw new DuesServiceError("NOT_FOUND", 404, "Dues record not found");
    }
    if (due.status === "verified" || due.status === "exempt") {
      throw new DuesServiceError("CONFLICT", 409, `Cannot exempt dues with status: ${due.status}`);
    }

    const [updated] = await tx
      .update(finMemberDues)
      .set({
        status: "exempt",
        exemptReason: reason,
        amount: "0",
        updatedBy: exemptedBy,
      })
      .where(eq(finMemberDues.id, duesId))
      .returning();

    if (!updated) {
      throw new Error("Failed to exempt dues record");
    }

    await writeAuditTx(tx, {
      actorId: exemptedBy,
      entityType: "fin_member_dues",
      entityId: duesId,
      action: "dues_exempted",
      before: due,
      after: updated,
      reason,
    });

    return updated;
  });
}

export async function upsertDuesConfig(
  db: DbClient,
  payload: UpsertDuesConfigPayload,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(finDuesConfig)
      .where(
        and(
          eq(finDuesConfig.memberId, payload.memberId),
          eq(finDuesConfig.staffPeriodId, payload.staffPeriodId),
        ),
      )
      .limit(1);

    const [config] = await tx
      .insert(finDuesConfig)
      .values({
        memberId: payload.memberId,
        staffPeriodId: payload.staffPeriodId,
        monthlyAmount: String(payload.monthlyAmount),
        leniencyType: payload.leniencyType,
        leniencyStart: payload.leniencyStart,
        leniencyEnd: payload.leniencyEnd,
        notes: payload.notes,
        configuredBy: actorId,
      })
      .onConflictDoUpdate({
        target: [finDuesConfig.memberId, finDuesConfig.staffPeriodId],
        set: {
          monthlyAmount: String(payload.monthlyAmount),
          leniencyType: payload.leniencyType,
          leniencyStart: payload.leniencyStart,
          leniencyEnd: payload.leniencyEnd,
          notes: payload.notes,
          updatedBy: actorId,
        },
      })
      .returning();

    if (!config) {
      throw new Error("Failed to save dues config");
    }

    await writeAuditTx(tx, {
      actorId,
      entityType: "fin_dues_config",
      entityId: config.id,
      action: existing ? "updated" : "created",
      before: existing,
      after: config,
    });

    return config;
  });
}
