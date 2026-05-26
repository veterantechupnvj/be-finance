import { and, eq, isNull } from "drizzle-orm";
import { db as database } from "../../db";
import { finCashflowEntries } from "../../db/schema";
import { writeAuditTx } from "../../lib/audit";

type DbClient = typeof database;
type CashflowServiceErrorCode = "INTERNAL_ERROR" | "NOT_FOUND";

export interface CreateCashflowPayload {
  type: "income" | "expense";
  entryKind: "normal" | "opening_balance" | "adjustment";
  categoryId: string;
  programId: string | null;
  description: string;
  amount: number;
  paymentMethod: "bni" | "gopay" | "cash";
  receiptUrl: string | null;
  date: string;
  notes: string | null;
}

export interface UpdateCashflowPayload {
  type?: "income" | "expense";
  entryKind?: "normal" | "opening_balance" | "adjustment";
  categoryId?: string;
  programId?: string | null;
  description?: string;
  amount?: number;
  paymentMethod?: "bni" | "gopay" | "cash";
  receiptUrl?: string | null;
  date?: string;
  notes?: string | null;
}

export class CashflowServiceError extends Error {
  constructor(
    public readonly code: CashflowServiceErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CashflowServiceError";
  }
}

export async function createCashflow(
  db: DbClient,
  payload: CreateCashflowPayload,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(finCashflowEntries)
      .values({
        type: payload.type,
        entryKind: payload.entryKind,
        categoryId: payload.categoryId,
        programId: payload.programId,
        description: payload.description,
        amount: String(payload.amount),
        paymentMethod: payload.paymentMethod,
        receiptUrl: payload.receiptUrl,
        date: payload.date,
        notes: payload.notes,
        recordedBy: actorId,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create cashflow entry");
    }

    await writeAuditTx(tx, {
      actorId,
      entityType: "fin_cashflow_entries",
      entityId: created.id,
      action: "created",
      after: created,
    });

    return created;
  });
}

export async function updateCashflow(
  db: DbClient,
  id: string,
  payload: UpdateCashflowPayload,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(finCashflowEntries)
      .where(and(eq(finCashflowEntries.id, id), isNull(finCashflowEntries.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new CashflowServiceError("NOT_FOUND", 404, "Cashflow entry not found");
    }

    const updates: Partial<typeof finCashflowEntries.$inferInsert> = {
      updatedBy: actorId,
    };

    if (payload.type !== undefined) {
      updates.type = payload.type;
    }
    if (payload.entryKind !== undefined) {
      updates.entryKind = payload.entryKind;
    }
    if (payload.categoryId !== undefined) {
      updates.categoryId = payload.categoryId;
    }
    if (payload.programId !== undefined) {
      updates.programId = payload.programId;
    }
    if (payload.description !== undefined) {
      updates.description = payload.description;
    }
    if (payload.amount !== undefined) {
      updates.amount = String(payload.amount);
    }
    if (payload.paymentMethod !== undefined) {
      updates.paymentMethod = payload.paymentMethod;
    }
    if (payload.receiptUrl !== undefined) {
      updates.receiptUrl = payload.receiptUrl;
    }
    if (payload.date !== undefined) {
      updates.date = payload.date;
    }
    if (payload.notes !== undefined) {
      updates.notes = payload.notes;
    }

    const [updated] = await tx
      .update(finCashflowEntries)
      .set(updates)
      .where(eq(finCashflowEntries.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update cashflow entry");
    }

    await writeAuditTx(tx, {
      actorId,
      entityType: "fin_cashflow_entries",
      entityId: id,
      action: "updated",
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export async function deleteCashflow(db: DbClient, id: string, actorId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(finCashflowEntries)
      .where(and(eq(finCashflowEntries.id, id), isNull(finCashflowEntries.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new CashflowServiceError("NOT_FOUND", 404, "Cashflow entry not found");
    }

    const [deleted] = await tx
      .update(finCashflowEntries)
      .set({
        deletedAt: new Date(),
        deletedBy: actorId,
        deleteReason: reason,
      })
      .where(eq(finCashflowEntries.id, id))
      .returning({ id: finCashflowEntries.id });

    if (!deleted) {
      throw new Error("Failed to delete cashflow entry");
    }

    await writeAuditTx(tx, {
      actorId,
      entityType: "fin_cashflow_entries",
      entityId: id,
      action: "deleted",
      before: existing,
      reason,
    });
  });
}
