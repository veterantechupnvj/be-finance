import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  auditEvents,
  finCashflowEntries,
  finCategories,
  finReimbursementRequests,
  members,
  programs,
} from "../../db/schema";
import { writeAudit, writeAuditTx } from "../../lib/audit";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import {
  approveReimbursementRoute,
  cancelReimbursementRoute,
  createReimbursementRoute,
  getReimbursementRoute,
  listReimbursementsRoute,
  markReimbursementPaidRoute,
  myReimbursementsRoute,
  rejectReimbursementRoute,
} from "./reimbursements.routes";

export const listReimbursementsHandler: AppRouteHandler<typeof listReimbursementsRoute> = async (
  c,
) => {
  const query = c.req.valid("query");

  const conditions: SQL[] = [isNull(finReimbursementRequests.deletedAt)];
  if (query.status) {
    conditions.push(eq(finReimbursementRequests.status, query.status));
  }
  if (query.member_id) {
    conditions.push(eq(finReimbursementRequests.memberId, query.member_id));
  }
  if (query.program_id) {
    conditions.push(eq(finReimbursementRequests.programId, query.program_id));
  }

  const rows = await db
    .select({
      id: finReimbursementRequests.id,
      activityTitle: finReimbursementRequests.activityTitle,
      amount: finReimbursementRequests.amount,
      status: finReimbursementRequests.status,
      paymentDestination: finReimbursementRequests.paymentDestination,
      accountInfo: finReimbursementRequests.accountInfo,
      purchaseReceiptUrl: finReimbursementRequests.purchaseReceiptUrl,
      transferReceiptUrl: finReimbursementRequests.transferReceiptUrl,
      rejectionReason: finReimbursementRequests.rejectionReason,
      approvedAt: finReimbursementRequests.approvedAt,
      paidAt: finReimbursementRequests.paidAt,
      createdAt: finReimbursementRequests.createdAt,
      member: { id: members.id, name: members.name, nim: members.nim },
      category: { id: finCategories.id, name: finCategories.name },
      program: { id: programs.id, name: programs.name },
    })
    .from(finReimbursementRequests)
    .leftJoin(members, eq(finReimbursementRequests.memberId, members.id))
    .leftJoin(finCategories, eq(finReimbursementRequests.categoryId, finCategories.id))
    .leftJoin(programs, eq(finReimbursementRequests.programId, programs.id))
    .where(and(...conditions))
    .orderBy(finReimbursementRequests.createdAt);

  return c.json(ok(rows), 200);
};

export const myReimbursementsHandler: AppRouteHandler<typeof myReimbursementsRoute> = async (c) => {
  const user = c.get("user");

  const rows = await db
    .select({
      id: finReimbursementRequests.id,
      activityTitle: finReimbursementRequests.activityTitle,
      amount: finReimbursementRequests.amount,
      status: finReimbursementRequests.status,
      purchaseReceiptUrl: finReimbursementRequests.purchaseReceiptUrl,
      transferReceiptUrl: finReimbursementRequests.transferReceiptUrl,
      rejectionReason: finReimbursementRequests.rejectionReason,
      createdAt: finReimbursementRequests.createdAt,
      category: { id: finCategories.id, name: finCategories.name },
    })
    .from(finReimbursementRequests)
    .leftJoin(finCategories, eq(finReimbursementRequests.categoryId, finCategories.id))
    .where(
      and(
        eq(finReimbursementRequests.memberId, user.memberId),
        isNull(finReimbursementRequests.deletedAt),
      ),
    )
    .orderBy(finReimbursementRequests.createdAt);

  return c.json(ok(rows), 200);
};

export const getReimbursementHandler: AppRouteHandler<typeof getReimbursementRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const user = c.get("user");
  const isFinance = user.roles.includes("finance");

  const [row] = await db
    .select({
      id: finReimbursementRequests.id,
      activityTitle: finReimbursementRequests.activityTitle,
      description: finReimbursementRequests.description,
      amount: finReimbursementRequests.amount,
      status: finReimbursementRequests.status,
      paymentDestination: finReimbursementRequests.paymentDestination,
      accountInfo: finReimbursementRequests.accountInfo,
      purchaseReceiptUrl: finReimbursementRequests.purchaseReceiptUrl,
      transferReceiptUrl: finReimbursementRequests.transferReceiptUrl,
      rejectionReason: finReimbursementRequests.rejectionReason,
      approvedAt: finReimbursementRequests.approvedAt,
      paidAt: finReimbursementRequests.paidAt,
      createdAt: finReimbursementRequests.createdAt,
      memberId: finReimbursementRequests.memberId,
      member: { id: members.id, name: members.name, nim: members.nim },
      category: { id: finCategories.id, name: finCategories.name },
      program: { id: programs.id, name: programs.name },
    })
    .from(finReimbursementRequests)
    .leftJoin(members, eq(finReimbursementRequests.memberId, members.id))
    .leftJoin(finCategories, eq(finReimbursementRequests.categoryId, finCategories.id))
    .leftJoin(programs, eq(finReimbursementRequests.programId, programs.id))
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!row) {
    return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
  }

  if (!isFinance && row.memberId !== user.memberId) {
    return c.json(err("FORBIDDEN", "You do not have permission to view this request"), 403);
  }

  const trail = await db
    .select({
      action: auditEvents.action,
      reason: auditEvents.reason,
      createdAt: auditEvents.createdAt,
      actorId: auditEvents.actorId,
    })
    .from(auditEvents)
    .where(
      and(eq(auditEvents.entityType, "fin_reimbursement_requests"), eq(auditEvents.entityId, id)),
    )
    .orderBy(auditEvents.createdAt);

  const actorIds = [...new Set(trail.map((entry) => entry.actorId).filter(Boolean))] as string[];
  const actors =
    actorIds.length > 0
      ? await db
          .select({ id: members.id, name: members.name })
          .from(members)
          .where(inArray(members.id, actorIds))
      : [];
  const actorMap = Object.fromEntries(actors.map((actor) => [actor.id, actor.name]));

  return c.json(
    ok({
      ...row,
      audit_trail: trail.map((entry) => ({
        action: entry.action,
        actor: entry.actorId
          ? {
              id: entry.actorId,
              name: actorMap[entry.actorId] ?? "Unknown",
            }
          : null,
        at: entry.createdAt,
        notes: entry.reason ?? null,
      })),
    }),
    200,
  );
};

export const createReimbursementHandler: AppRouteHandler<typeof createReimbursementRoute> = async (
  c,
) => {
  const user = c.get("user");
  const data = c.req.valid("json");

  const [created] = await db
    .insert(finReimbursementRequests)
    .values({
      memberId: user.memberId,
      programId: data.program_id ?? null,
      categoryId: data.category_id,
      activityTitle: data.activity_title,
      description: data.description ?? null,
      amount: String(data.amount),
      purchaseReceiptUrl: data.purchase_receipt_url,
      paymentDestination: data.payment_destination,
      accountInfo: data.account_info,
      status: "submitted",
      createdBy: user.memberId,
    })
    .returning();

  if (!created) {
    return c.json(err("INTERNAL_ERROR", "Failed to create reimbursement"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: created.id,
    action: "reimbursement_submitted",
    after: created,
  });

  return c.json(ok(created), 201);
};

export const approveReimbursementHandler: AppRouteHandler<
  typeof approveReimbursementRoute
> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) {
    return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
  }
  if (reimbursement.status !== "submitted") {
    return c.json(
      err("CONFLICT", `Cannot approve request with status: ${reimbursement.status}`),
      409,
    );
  }

  const [updated] = await db
    .update(finReimbursementRequests)
    .set({
      status: "approved",
      approvedBy: user.memberId,
      approvedAt: new Date(),
      updatedBy: user.memberId,
    })
    .where(eq(finReimbursementRequests.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to approve reimbursement"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: id,
    action: "reimbursement_approved",
    before: reimbursement,
    after: updated,
  });

  return c.json(ok(updated), 200);
};

export const rejectReimbursementHandler: AppRouteHandler<typeof rejectReimbursementRoute> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const { reason } = c.req.valid("json");

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) {
    return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
  }
  if (reimbursement.status !== "submitted") {
    return c.json(
      err("CONFLICT", `Cannot reject request with status: ${reimbursement.status}`),
      409,
    );
  }

  const [updated] = await db
    .update(finReimbursementRequests)
    .set({
      status: "rejected",
      rejectionReason: reason,
      updatedBy: user.memberId,
    })
    .where(eq(finReimbursementRequests.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to reject reimbursement"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: id,
    action: "reimbursement_rejected",
    before: reimbursement,
    after: updated,
    reason,
  });

  return c.json(ok(updated), 200);
};

export const markReimbursementPaidHandler: AppRouteHandler<
  typeof markReimbursementPaidRoute
> = async (c) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const { transfer_receipt_url } = c.req.valid("json");

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) {
    return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
  }
  if (reimbursement.status !== "approved") {
    return c.json(err("CONFLICT", `Cannot mark as paid: status is ${reimbursement.status}`), 409);
  }

  await db.transaction(async (tx) => {
    const [cashflowEntry] = await tx
      .insert(finCashflowEntries)
      .values({
        type: "expense",
        entryKind: "normal",
        categoryId: reimbursement.categoryId,
        programId: reimbursement.programId,
        description: `Reimbursement: ${reimbursement.activityTitle}`,
        amount: reimbursement.amount,
        paymentMethod: reimbursement.paymentDestination,
        receiptUrl: transfer_receipt_url,
        sourceId: reimbursement.id,
        recordedBy: user.memberId,
        date: new Date().toISOString().split("T")[0],
      })
      .returning();

    if (!cashflowEntry) {
      throw new Error("Failed to create cashflow entry for reimbursement payment");
    }

    const [updated] = await tx
      .update(finReimbursementRequests)
      .set({
        status: "paid",
        transferReceiptUrl: transfer_receipt_url,
        paidAt: new Date(),
        cashflowEntryId: cashflowEntry.id,
        updatedBy: user.memberId,
      })
      .where(eq(finReimbursementRequests.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update reimbursement payment status");
    }

    await writeAuditTx(tx, {
      actorId: user.memberId,
      entityType: "fin_reimbursement_requests",
      entityId: id,
      action: "reimbursement_paid",
      before: reimbursement,
      after: updated,
    });
  });

  return c.json(ok({ id, status: "paid", cashflow_entry_created: true }), 200);
};

export const cancelReimbursementHandler: AppRouteHandler<typeof cancelReimbursementRoute> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) {
    return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
  }

  if (reimbursement.memberId !== user.memberId && !user.roles.includes("finance")) {
    return c.json(err("FORBIDDEN", "You can only cancel your own requests"), 403);
  }

  if (!["draft", "submitted"].includes(reimbursement.status)) {
    return c.json(
      err("CONFLICT", `Cannot cancel request with status: ${reimbursement.status}`),
      409,
    );
  }

  const [updated] = await db
    .update(finReimbursementRequests)
    .set({ status: "cancelled", updatedBy: user.memberId })
    .where(eq(finReimbursementRequests.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to cancel reimbursement"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: id,
    action: "reimbursement_cancelled",
    before: reimbursement,
    after: updated,
  });

  return c.json(ok(updated), 200);
};
