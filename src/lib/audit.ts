// src/lib/audit.ts
//
// Usage: call writeAudit() manually inside route handlers after
// a successful mutation. Never call inside a try/catch that swallows
// the audit failure - let it propagate so the caller can decide.
//
// Example:
//   await writeAudit({
//     actorId: user.memberId,
//     entityType: "fin_cashflow_entries",
//     entityId: entry.id,
//     action: "created",
//     after: entry,
//   });

import { db } from "../db";
import { auditEvents } from "../db/schema";

export interface AuditParams {
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  reason?: string;
  executor?: any;
}

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "dues_submitted"
  | "dues_verified"
  | "dues_rejected"
  | "dues_exempted"
  | "reimbursement_submitted"
  | "reimbursement_approved"
  | "reimbursement_rejected"
  | "reimbursement_paid"
  | "reimbursement_cancelled"
  | "cashflow_voided"
  | "password_changed"
  | "role_assigned"
  | "role_revoked";

export async function writeAudit(params: AuditParams): Promise<void> {
  const executor = params.executor ?? db;

  await executor.insert(auditEvents).values({
    actorId: params.actorId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    before: params.before ?? null,
    after: params.after ?? null,
    reason: params.reason ?? null,
  });
}

export async function writeAuditSafe(params: AuditParams): Promise<void> {
  try {
    await writeAudit(params);
  } catch (e) {
    console.error("[audit] Failed to write audit event:", e);
  }
}
