import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const memberTypeEnum = pgEnum("member_type", ["member", "staff", "alumni"]);

export const memberStatusEnum = pgEnum("member_status", ["active", "inactive"]);

// ============================================================
// MEMBERS — single source of truth for every person in VeteranTech
// No email/phone per PRD — auth uses NIM + password
// ============================================================

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nim: varchar("nim", { length: 50 }).notNull().unique(),
  cohortYear: integer("cohort_year").notNull(),
  memberType: memberTypeEnum("member_type").notNull().default("member"),
  status: memberStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// USERS — auth concern, 1:1 with members
// Not every member needs a user row — only those with dashboard access
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .unique()
    .references(() => members.id, { onDelete: "cascade" }),
  username: varchar("username", { length: 100 }).notNull().unique(), // seeded from NIM
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// ROLES — dashboard permissions, NOT org jabatan
// permissions stored as JSONB for flexibility
// MVP seeds: 'finance', 'member'
// ============================================================

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  permissions: jsonb("permissions").notNull(), // e.g. {"finance": ["read", "write"], "members": ["read"]}
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// MEMBER_ROLES — many-to-many members ↔ roles
// ============================================================

export const memberRoles = pgTable(
  "member_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueMemberRole: unique("uq_member_role").on(table.memberId, table.roleId),
  }),
);

// ============================================================
// RELATIONS
// ============================================================

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, {
    fields: [members.id],
    references: [users.memberId],
  }),
  memberRoles: many(memberRoles),
}));

export const usersRelations = relations(users, ({ one }) => ({
  member: one(members, {
    fields: [users.memberId],
    references: [members.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  memberRoles: many(memberRoles),
}));

export const memberRolesRelations = relations(memberRoles, ({ one }) => ({
  member: one(members, {
    fields: [memberRoles.memberId],
    references: [members.id],
  }),
  role: one(roles, {
    fields: [memberRoles.roleId],
    references: [roles.id],
  }),
  assignedByMember: one(members, {
    fields: [memberRoles.assignedBy],
    references: [members.id],
  }),
}));
