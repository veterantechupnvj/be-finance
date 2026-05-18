// src/routes/finance/dues.ts
import { Hono } from "hono";
import { eq, and, isNull, SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import {
  finMemberDues,
  finDuesConfig,
  finCashflowEntries,
  finCategories,
  members,
} from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { ok, err } from "../../lib/response";
import { writeAudit, writeAuditTx } from "../../lib/audit";
import type { TokenPayload } from "../../lib/jwt";

const router = new Hono();

const DEFAULT_DUES_AMOUNT = "15000"; // Rp15.000 — fallback if no config exists

// ============================================================
// GET /finance/dues
// [finance] — all dues records with filters
// ============================================================

router.get("/", requireAuth, requireRole("finance"), async (c) => {
  const month = c.req.query("month") ? Number(c.req.query("month")) : undefined;
  const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
  const status = c.req.query("status");
  const memberId = c.req.query("member_id");

  const conditions: SQL[] = [isNull(finMemberDues.deletedAt)];
  if (month) conditions.push(eq(finMemberDues.month, month));
  if (year) conditions.push(eq(finMemberDues.year, year));
  if (status) conditions.push(eq(finMemberDues.status, status as any));
  if (memberId) conditions.push(eq(finMemberDues.memberId, memberId));

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

  return c.json(ok(rows));
});

// ============================================================
// GET /finance/dues/me
// [member] — current user's own dues status
// ============================================================

router.get("/me", requireAuth, async (c) => {
  const user = c.get("user") as TokenPayload;
  const year = Number(c.req.query("year") ?? new Date().getFullYear());

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
        eq(finMemberDues.year, year),
        isNull(finMemberDues.deletedAt),
      ),
    )
    .orderBy(finMemberDues.month);

  return c.json(ok(rows));
});

// ============================================================
// POST /finance/dues/pay
// [member] — submit payment proof for a given month
// ============================================================

router.post("/pay", requireAuth, async (c) => {
  const schema = z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020),
    payment_method: z.enum(["bni", "gopay", "cash"]),
    receipt_url: z.string().url(),
  });

  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const { month, year, payment_method, receipt_url } = parsed.data;

  // Check for duplicate
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

  // Resolve amount from config or fallback to default
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
});

// ============================================================
// PATCH /finance/dues/:id/verify
// [finance] — verify a pending dues payment, auto-creates cashflow entry
// ============================================================

router.patch("/:id/verify", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as TokenPayload;

  const [due] = await db
    .select()
    .from(finMemberDues)
    .where(and(eq(finMemberDues.id, id), isNull(finMemberDues.deletedAt)))
    .limit(1);

  if (!due) return c.json(err("NOT_FOUND", "Dues record not found"), 404);
  if (due.status !== "pending") {
    return c.json(err("CONFLICT", `Cannot verify dues with status: ${due.status}`), 409);
  }

  // Get MemberDues category id for cashflow entry
  const [category] = await db
    .select({ id: finCategories.id })
    .from(finCategories)
    .where(eq(finCategories.name, "MemberDues"))
    .limit(1);

  if (!category) {
    return c.json(err("INTERNAL_ERROR", "MemberDues category not found — check seed data"), 500);
  }

  await db.transaction(async (tx) => {
    // Auto-create cashflow entry
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

    // Update dues record
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
    ok({ id, status: "verified", message: "Dues verified and cashflow entry created" }),
  );
});

// ============================================================
// PATCH /finance/dues/:id/exempt
// [finance] — mark a member exempt for a month
// ============================================================

router.patch("/:id/exempt", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const schema = z.object({
    exempt_reason: z.string().min(1),
  });

  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", "exempt_reason is required"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [due] = await db
    .select()
    .from(finMemberDues)
    .where(and(eq(finMemberDues.id, id), isNull(finMemberDues.deletedAt)))
    .limit(1);

  if (!due) return c.json(err("NOT_FOUND", "Dues record not found"), 404);

  const [updated] = await db
    .update(finMemberDues)
    .set({
      status: "exempt",
      exemptReason: parsed.data.exempt_reason,
      amount: "0",
      updatedBy: user.memberId,
    })
    .where(eq(finMemberDues.id, id))
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_member_dues",
    entityId: id,
    action: "dues_exempted",
    before: due,
    after: updated,
    reason: parsed.data.exempt_reason,
  });

  return c.json(ok(updated));
});

// ============================================================
// GET /finance/dues/config/:member_id
// [finance] — get leniency config for a member
// ============================================================

router.get("/config/:member_id", requireAuth, requireRole("finance"), async (c) => {
  const { member_id } = c.req.param();

  const rows = await db.select().from(finDuesConfig).where(eq(finDuesConfig.memberId, member_id));

  return c.json(ok(rows));
});

// ============================================================
// POST /finance/dues/config
// [finance] — set leniency config for a member
// ============================================================

router.post("/config", requireAuth, requireRole("finance"), async (c) => {
  const schema = z.object({
    member_id: z.string().uuid(),
    staff_period_id: z.string().uuid(),
    monthly_amount: z.number().positive(),
    leniency_type: z.enum(["none", "reduced_fixed", "reduced_temporary"]),
    leniency_start: z.string().date().nullable().optional(),
    leniency_end: z.string().date().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const data = parsed.data;

  // Upsert — update if exists for this member+period, else insert
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

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_dues_config",
    entityId: config.id,
    action: "updated",
    after: config,
  });

  return c.json(ok(config), 201);
});

export default router;
