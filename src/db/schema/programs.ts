import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { members } from "./core";
import { divisions } from "./org";

// ============================================================
// ENUMS
// ============================================================

export const programTypeEnum = pgEnum("program_type", [
  "event",
  "recurring",
  "external",
  "flagship",
]);

export const programStatusEnum = pgEnum("program_status", [
  "planning",
  "active",
  "completed",
  "cancelled",
]);

// ============================================================
// PROGRAMS — work programs, events, external projects
// ============================================================

export const programs = pgTable("programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: programTypeEnum("type").notNull(),
  divisionId: uuid("division_id").references(() => divisions.id, { onDelete: "set null" }),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  status: programStatusEnum("status").notNull().default("planning"),
  description: text("description"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// RELATIONS
// ============================================================

export const programsRelations = relations(programs, ({ one }) => ({
  division: one(divisions, {
    fields: [programs.divisionId],
    references: [divisions.id],
  }),
  creator: one(members, {
    fields: [programs.createdBy],
    references: [members.id],
  }),
}));
