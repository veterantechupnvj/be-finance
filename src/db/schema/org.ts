import {
  pgTable,
  uuid,
  varchar,
  boolean,
  date,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { members } from "./core";

// ============================================================
// ENUMS
// ============================================================

export const positionEnum = pgEnum("position", [
  "president",
  "vice_president",
  "division_head",
  "deputy_division_head",
  "staff",
]);

// ============================================================
// UNITS — top-level org structure: R&D, Growth, Operations
// ============================================================

export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// DIVISIONS — subdivisions within units
// unit_id nullable for standalone divisions (e.g. Lombakan)
// ============================================================

export const divisions = pgTable("divisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// STAFF_PERIODS — each staff cycle (e.g. "Staff 2025/2026")
// only one active at a time, end_date null if ongoing
// ============================================================

export const staffPeriods = pgTable("staff_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// STAFF_MEMBERS — who holds what position in which division
// during which staff period. Historical rows preserved.
// ============================================================

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffPeriods.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    divisionId: uuid("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    position: positionEnum("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueStaffMember: unique("uq_staff_member").on(table.staffId, table.memberId),
  }),
);

// ============================================================
// RELATIONS
// ============================================================

export const unitsRelations = relations(units, ({ many }) => ({
  divisions: many(divisions),
}));

export const divisionsRelations = relations(divisions, ({ one, many }) => ({
  unit: one(units, {
    fields: [divisions.unitId],
    references: [units.id],
  }),
  staffMembers: many(staffMembers),
}));

export const staffPeriodsRelations = relations(staffPeriods, ({ many }) => ({
  staffMembers: many(staffMembers),
}));

export const staffMembersRelations = relations(staffMembers, ({ one }) => ({
  staffPeriod: one(staffPeriods, {
    fields: [staffMembers.staffId],
    references: [staffPeriods.id],
  }),
  member: one(members, {
    fields: [staffMembers.memberId],
    references: [members.id],
  }),
  division: one(divisions, {
    fields: [staffMembers.divisionId],
    references: [divisions.id],
  }),
}));
