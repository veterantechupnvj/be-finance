import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  date,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { members } from "./core";
import { programs } from "./programs";
import { staffPeriods } from "./org";

// ============================================================
// ENUMS
// ============================================================

export const finTypeEnum = pgEnum("fin_type", ["income", "expense"]);

export const entryKindEnum = pgEnum("entry_kind", ["normal", "opening_balance", "adjustment"]);

export const paymentMethodEnum = pgEnum("payment_method", ["bni", "gopay", "cash"]);

export const leniencyTypeEnum = pgEnum("leniency_type", [
  "none",
  "reduced_fixed",
  "reduced_temporary",
]);

export const duesStatusEnum = pgEnum("dues_status", ["unpaid", "pending", "verified", "exempt"]);

export const reimbursementStatusEnum = pgEnum("reimbursement_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "paid",
  "cancelled",
]);

export const reimbursementPaymentDestEnum = pgEnum("reimbursement_payment_dest", ["bni", "gopay"]);

// ============================================================
// FIN_CATEGORIES — simplified chart of accounts
// ============================================================

export const finCategories = pgTable("fin_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: finTypeEnum("type").notNull(),
  parentId: uuid("parent_id").references((): any => finCategories.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// FIN_CASHFLOW_ENTRIES — core ledger, soft delete
// programId uses .references() directly since programs.ts does
// not import finance.ts — no circular dependency.
// ============================================================

export const finCashflowEntries = pgTable("fin_cashflow_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: finTypeEnum("type").notNull(),
  entryKind: entryKindEnum("entry_kind").notNull().default("normal"),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => finCategories.id),
  programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }), // nullable — not all entries are program-linked
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  receiptUrl: varchar("receipt_url", { length: 500 }),
  sourceId: uuid("source_id"), // polymorphic FK — resolve via category_id
  recordedBy: uuid("recorded_by")
    .notNull()
    .references(() => members.id),
  updatedBy: uuid("updated_by").references(() => members.id),
  deletedBy: uuid("deleted_by").references(() => members.id),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deleteReason: text("delete_reason"),
});

// ============================================================
// FIN_DUES_CONFIG — per-member leniency rules per staff period
// Only created for members with non-standard amounts.
// Members without a config row default to Rp15.000/month.
// ============================================================

export const finDuesConfig = pgTable(
  "fin_dues_config",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffPeriodId: uuid("staff_period_id")
      .notNull()
      .references(() => staffPeriods.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    monthlyAmount: decimal("monthly_amount", { precision: 15, scale: 2 }).notNull(),
    leniencyType: leniencyTypeEnum("leniency_type").notNull().default("none"),
    // leniency_start / leniency_end used for reduced_temporary:
    // defines which month range the custom amount applies to.
    // Stored as first day of month (e.g. 2026-03-01).
    leniencyStart: date("leniency_start"),
    leniencyEnd: date("leniency_end"),
    notes: text("notes"), // reason for leniency
    configuredBy: uuid("configured_by")
      .notNull()
      .references(() => members.id),
    updatedBy: uuid("updated_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueMemberPeriod: unique("uq_dues_config_member_period").on(
      table.staffPeriodId,
      table.memberId,
    ),
  }),
);

// ============================================================
// FIN_MEMBER_DUES — monthly dues record per member
//
// duesConfigId is nullable — members without a leniency config
// are standard rate (Rp15.000). App logic resolves amount from
// config if present, otherwise uses the period default.
//
// month: INTEGER 1-12, year: INTEGER e.g. 2026
// UNIQUE on (memberId, month, year)
// ============================================================

export const finMemberDues = pgTable(
  "fin_member_dues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    duesConfigId: uuid("dues_config_id").references(() => finDuesConfig.id, {
      onDelete: "set null",
    }), // nullable — standard members have no config
    month: integer("month").notNull(), // 1-12
    year: integer("year").notNull(), // e.g. 2026
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    status: duesStatusEnum("status").notNull().default("unpaid"),
    exemptReason: varchar("exempt_reason", { length: 255 }), // e.g. "Top point March 2026"
    receiptUrl: varchar("receipt_url", { length: 500 }),
    paymentMethod: paymentMethodEnum("payment_method"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by").references(() => members.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    cashflowEntryId: uuid("cashflow_entry_id").references(() => finCashflowEntries.id),
    createdBy: uuid("created_by").references(() => members.id),
    updatedBy: uuid("updated_by").references(() => members.id),
    deletedBy: uuid("deleted_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deleteReason: text("delete_reason"),
  },
  (table) => ({
    uniqueMemberMonth: unique("uq_member_dues_month").on(table.memberId, table.month, table.year),
  }),
);

// ============================================================
// FIN_REIMBURSEMENT_REQUESTS — full approval workflow
// ============================================================

export const finReimbursementRequests = pgTable("fin_reimbursement_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }), // nullable — not all reimbursements are program-linked
  categoryId: uuid("category_id")
    .notNull()
    .references(() => finCategories.id), // used to auto-set cashflow entry category
  activityTitle: varchar("activity_title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  purchaseReceiptUrl: varchar("purchase_receipt_url", { length: 500 }).notNull(),
  paymentDestination: reimbursementPaymentDestEnum("payment_destination").notNull(),
  accountInfo: varchar("account_info", { length: 100 }).notNull(), // account number or gopay phone
  status: reimbursementStatusEnum("status").notNull().default("submitted"),
  rejectionReason: text("rejection_reason"),
  approvedBy: uuid("approved_by").references(() => members.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  transferReceiptUrl: varchar("transfer_receipt_url", { length: 500 }), // uploaded after manual payment
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cashflowEntryId: uuid("cashflow_entry_id").references(() => finCashflowEntries.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => members.id),
  updatedBy: uuid("updated_by").references(() => members.id),
  deletedBy: uuid("deleted_by").references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deleteReason: text("delete_reason"),
});

// ============================================================
// FIN_MERCH_PRODUCTS — merch catalog
// cost_price tracked for profit margin reporting (PRD §4.2)
// ============================================================

export const finMerchProducts = pgTable("fin_merch_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  merchLine: varchar("merch_line", { length: 255 }), // e.g. "VT 2026"
  designUrl: varchar("design_url", { length: 500 }),
  costPrice: decimal("cost_price", { precision: 15, scale: 2 }).notNull(), // purchase/production cost
  sellingPrice: decimal("selling_price", { precision: 15, scale: 2 }).notNull(), // price sold to buyer
  stock: integer("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => members.id),
  updatedBy: uuid("updated_by").references(() => members.id),
  deletedBy: uuid("deleted_by").references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deleteReason: text("delete_reason"),
});

// ============================================================
// FIN_MERCH_SALES — merch sale records
// total is NOT stored — compute as qty * unit_price at query time
// ============================================================

export const finMerchSales = pgTable("fin_merch_sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => finMerchProducts.id),
  buyerMemberId: uuid("buyer_member_id").references(() => members.id), // nullable for external buyers
  buyerName: varchar("buyer_name", { length: 255 }), // for non-member buyers
  qty: integer("qty").notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(), // selling_price at time of sale
  // total intentionally omitted — compute as qty * unit_price
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  receiptUrl: varchar("receipt_url", { length: 500 }),
  cashflowEntryId: uuid("cashflow_entry_id").references(() => finCashflowEntries.id),
  recordedBy: uuid("recorded_by")
    .notNull()
    .references(() => members.id),
  updatedBy: uuid("updated_by").references(() => members.id),
  deletedBy: uuid("deleted_by").references(() => members.id),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deleteReason: text("delete_reason"),
});

// ============================================================
// RELATIONS
// ============================================================

export const finCategoriesRelations = relations(finCategories, ({ one, many }) => ({
  parent: one(finCategories, {
    fields: [finCategories.parentId],
    references: [finCategories.id],
    relationName: "categoryParent",
  }),
  children: many(finCategories, { relationName: "categoryParent" }),
  cashflowEntries: many(finCashflowEntries),
  reimbursementRequests: many(finReimbursementRequests),
}));

export const finCashflowEntriesRelations = relations(finCashflowEntries, ({ one, many }) => ({
  category: one(finCategories, {
    fields: [finCashflowEntries.categoryId],
    references: [finCategories.id],
  }),
  program: one(programs, {
    fields: [finCashflowEntries.programId],
    references: [programs.id],
  }),
  recorder: one(members, {
    fields: [finCashflowEntries.recordedBy],
    references: [members.id],
    relationName: "cashflowRecorder",
  }),
  updatedByMember: one(members, {
    fields: [finCashflowEntries.updatedBy],
    references: [members.id],
    relationName: "cashflowUpdater",
  }),
  memberDues: many(finMemberDues),
  reimbursements: many(finReimbursementRequests),
  merchSales: many(finMerchSales),
}));

export const finDuesConfigRelations = relations(finDuesConfig, ({ one, many }) => ({
  staffPeriod: one(staffPeriods, {
    fields: [finDuesConfig.staffPeriodId],
    references: [staffPeriods.id],
  }),
  member: one(members, {
    fields: [finDuesConfig.memberId],
    references: [members.id],
  }),
  configuredByMember: one(members, {
    fields: [finDuesConfig.configuredBy],
    references: [members.id],
    relationName: "duesConfiguredBy",
  }),
  dues: many(finMemberDues),
}));

export const finMemberDuesRelations = relations(finMemberDues, ({ one }) => ({
  member: one(members, {
    fields: [finMemberDues.memberId],
    references: [members.id],
  }),
  duesConfig: one(finDuesConfig, {
    fields: [finMemberDues.duesConfigId],
    references: [finDuesConfig.id],
  }),
  verifier: one(members, {
    fields: [finMemberDues.verifiedBy],
    references: [members.id],
    relationName: "duesVerifier",
  }),
  cashflowEntry: one(finCashflowEntries, {
    fields: [finMemberDues.cashflowEntryId],
    references: [finCashflowEntries.id],
  }),
}));

export const finReimbursementRequestsRelations = relations(finReimbursementRequests, ({ one }) => ({
  member: one(members, {
    fields: [finReimbursementRequests.memberId],
    references: [members.id],
    relationName: "reimbursementMember",
  }),
  program: one(programs, {
    fields: [finReimbursementRequests.programId],
    references: [programs.id],
  }),
  category: one(finCategories, {
    fields: [finReimbursementRequests.categoryId],
    references: [finCategories.id],
  }),
  approver: one(members, {
    fields: [finReimbursementRequests.approvedBy],
    references: [members.id],
    relationName: "reimbursementApprover",
  }),
  cashflowEntry: one(finCashflowEntries, {
    fields: [finReimbursementRequests.cashflowEntryId],
    references: [finCashflowEntries.id],
  }),
}));

export const finMerchProductsRelations = relations(finMerchProducts, ({ many }) => ({
  sales: many(finMerchSales),
}));

export const finMerchSalesRelations = relations(finMerchSales, ({ one }) => ({
  product: one(finMerchProducts, {
    fields: [finMerchSales.productId],
    references: [finMerchProducts.id],
  }),
  buyerMember: one(members, {
    fields: [finMerchSales.buyerMemberId],
    references: [members.id],
    relationName: "merchSaleBuyer",
  }),
  recorder: one(members, {
    fields: [finMerchSales.recordedBy],
    references: [members.id],
    relationName: "merchSaleRecorder",
  }),
  cashflowEntry: one(finCashflowEntries, {
    fields: [finMerchSales.cashflowEntryId],
    references: [finCashflowEntries.id],
  }),
}));
