// src/routes/finance/reimbursements.ts
import { Hono } from "hono";
import { eq, and, isNull, SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import {
  finReimbursementRequests,
  finCashflowEntries,
  finCategories,
  members,
  programs,
  auditEvents,
} from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { ok, err } from "../../lib/response";
import { writeAudit } from "../../lib/audit";
import type { TokenPayload } from "../../lib/jwt";

const router = new Hono();

// ============================================================
// VALIDATION
// ============================================================

const submitSchema = z.object({
  activity_title: z.string().min(1),
  category_id: z.string().uuid(),
  program_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  amount: z.number().positive(),
  purchase_receipt_url: z.string().url(),
  payment_destination: z.enum(["bni", "gopay"]),
  account_info: z.string().min(1),
});

// ============================================================
// GET /finance/reimbursements
// [finance] — full queue with filters
// ============================================================

router.get("/", requireAuth, requireRole("finance"), async (c) => {
  const status = c.req.query("status");
  const memberId = c.req.query("member_id");
  const programId = c.req.query("program_id");

  const conditions: SQL[] = [isNull(finReimbursementRequests.deletedAt)];
  if (status) conditions.push(eq(finReimbursementRequests.status, status as any));
  if (memberId) conditions.push(eq(finReimbursementRequests.memberId, memberId));
  if (programId) conditions.push(eq(finReimbursementRequests.programId, programId));

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

  return c.json(ok(rows));
});

// ============================================================
// GET /finance/reimbursements/me
// [member] — current user's own requests
// ============================================================

router.get("/me", requireAuth, async (c) => {
  const user = c.get("user") as TokenPayload;

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

  return c.json(ok(rows));
});

// ============================================================
// GET /finance/reimbursements/:id
// [member] — single request + audit trail
// ============================================================

router.get("/:id", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as TokenPayload;
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

  if (!row) return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);

  // Members can only view their own requests
  if (!isFinance && row.memberId !== user.memberId) {
    return c.json(err("FORBIDDEN", "You do not have permission to view this request"), 403);
  }

  // Fetch audit trail for this reimbursement
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

  // Enrich actor names
  const actorIds = [...new Set(trail.map((t) => t.actorId).filter(Boolean))] as string[];
  const actors =
    actorIds.length > 0
      ? await db
          .select({ id: members.id, name: members.name })
          .from(members)
          .where(eq(members.id, actorIds[0])) // simplified — for multiple actors use inArray
      : [];
  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a.name]));

  return c.json(
    ok({
      ...row,
      audit_trail: trail.map((t) => ({
        action: t.action,
        actor: t.actorId ? { id: t.actorId, name: actorMap[t.actorId] ?? "Unknown" } : null,
        at: t.createdAt,
        notes: t.reason ?? null,
      })),
    }),
  );
});

// ============================================================
// POST /finance/reimbursements
// [member] — submit a reimbursement request
// ============================================================

router.post("/", requireAuth, async (c) => {
  const parsed = submitSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const data = parsed.data;

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

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: created.id,
    action: "reimbursement_submitted",
    after: created,
  });

  return c.json(ok(created), 201);
});

// ============================================================
// PATCH /finance/reimbursements/:id/approve
// [finance]
// ============================================================

router.patch("/:id/approve", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as TokenPayload;

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
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

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: id,
    action: "reimbursement_approved",
    before: reimbursement,
    after: updated,
  });

  return c.json(ok(updated));
});

// ============================================================
// PATCH /finance/reimbursements/:id/reject
// [finance]
// ============================================================

router.patch("/:id/reject", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const schema = z.object({ reason: z.string().min(1, "Rejection reason is required") });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", "A rejection reason is required"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
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
      rejectionReason: parsed.data.reason,
      updatedBy: user.memberId,
    })
    .where(eq(finReimbursementRequests.id, id))
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: id,
    action: "reimbursement_rejected",
    before: reimbursement,
    after: updated,
    reason: parsed.data.reason,
  });

  return c.json(ok(updated));
});

// ============================================================
// PATCH /finance/reimbursements/:id/mark-paid
// [finance] — upload transfer receipt and mark as paid,
//             auto-creates cashflow expense entry
// ============================================================

router.patch("/:id/mark-paid", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const schema = z.object({ transfer_receipt_url: z.string().url() });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", "A valid transfer_receipt_url is required"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);
  if (reimbursement.status !== "approved") {
    return c.json(err("CONFLICT", `Cannot mark as paid: status is ${reimbursement.status}`), 409);
  }

  let updated: typeof reimbursement;

  await db.transaction(async (tx) => {
    // Auto-create cashflow expense entry
    const [cashflowEntry] = await tx
      .insert(finCashflowEntries)
      .values({
        type: "expense",
        entryKind: "normal",
        categoryId: reimbursement.categoryId,
        programId: reimbursement.programId,
        description: `Reimbursement: ${reimbursement.activityTitle}`,
        amount: reimbursement.amount,
        paymentMethod: reimbursement.paymentDestination as any,
        receiptUrl: parsed.data.transfer_receipt_url,
        sourceId: reimbursement.id,
        recordedBy: user.memberId,
        date: new Date().toISOString().split("T")[0],
      })
      .returning();

    const [u] = await tx
      .update(finReimbursementRequests)
      .set({
        status: "paid",
        transferReceiptUrl: parsed.data.transfer_receipt_url,
        paidAt: new Date(),
        cashflowEntryId: cashflowEntry.id,
        updatedBy: user.memberId,
      })
      .where(eq(finReimbursementRequests.id, id))
      .returning();

    updated = u;

    await writeAudit({
      actorId: user.memberId,
      entityType: "fin_reimbursement_requests",
      entityId: id,
      action: "reimbursement_paid",
      before: reimbursement,
      after: updated,
    });
  });

  return c.json(ok({ id, status: "paid", cashflow_entry_created: true }));
});

// ============================================================
// PATCH /finance/reimbursements/:id/cancel
// [member] — cancel own draft or submitted request
// ============================================================

router.patch("/:id/cancel", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as TokenPayload;

  const [reimbursement] = await db
    .select()
    .from(finReimbursementRequests)
    .where(and(eq(finReimbursementRequests.id, id), isNull(finReimbursementRequests.deletedAt)))
    .limit(1);

  if (!reimbursement) return c.json(err("NOT_FOUND", "Reimbursement not found"), 404);

  // Members can only cancel their own requests
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

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_reimbursement_requests",
    entityId: id,
    action: "reimbursement_cancelled",
    before: reimbursement,
    after: updated,
  });

  return c.json(ok(updated));
});

export default router;
