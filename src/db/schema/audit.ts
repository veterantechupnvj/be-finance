import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { members } from "./core";

// ============================================================
// AUDIT_EVENTS — immutable, append-only audit trail
// No soft delete. No updates. Ever.
// ============================================================

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => members.id, { onDelete: "set null" }),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(), // 'created', 'updated', 'verified', 'voided', etc.
  before: jsonb("before"),
  after: jsonb("after"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// RELATIONS
// ============================================================

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(members, {
    fields: [auditEvents.actorId],
    references: [members.id],
  }),
}));
