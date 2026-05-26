import { z } from "@hono/zod-openapi";
import {
  createPaginatedSchema,
  createSuccessSchema,
  dateSchema,
  dateTimeSchema,
  idParamSchema,
  uuidSchema,
} from "../../lib/openapi";

export const cashflowTypeSchema = z.enum(["income", "expense"]);
export const cashflowEntryKindSchema = z.enum(["normal", "opening_balance", "adjustment"]);
export const cashflowPaymentMethodSchema = z.enum(["bni", "gopay", "cash"]);

export const cashflowListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
    type: cashflowTypeSchema.optional(),
    entry_kind: cashflowEntryKindSchema.optional(),
    category_id: uuidSchema.optional(),
    program_id: uuidSchema.optional(),
    payment_method: cashflowPaymentMethodSchema.optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    include_deleted: z.coerce.boolean().optional(),
  })
  .openapi("CashflowListQuery");

export const cashflowSummaryQuerySchema = z
  .object({
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .openapi("CashflowSummaryQuery");

export const createCashflowRequestSchema = z
  .object({
    type: cashflowTypeSchema,
    entry_kind: cashflowEntryKindSchema.default("normal"),
    category_id: uuidSchema,
    program_id: uuidSchema.nullable().optional(),
    description: z.string().min(1),
    amount: z.number().positive(),
    payment_method: cashflowPaymentMethodSchema,
    receipt_url: z.string().url().nullable().optional(),
    date: dateSchema,
    notes: z.string().nullable().optional(),
  })
  .openapi("CreateCashflowRequest");

export const updateCashflowRequestSchema = createCashflowRequestSchema
  .partial()
  .openapi("UpdateCashflowRequest");

export const deleteCashflowRequestSchema = z
  .object({
    reason: z.string().min(1),
  })
  .openapi("DeleteCashflowRequest");

export const cashflowPathSchema = idParamSchema.openapi("CashflowPathParams");

export const cashflowRelationSchema = z.object({
  id: uuidSchema.nullable(),
  name: z.string().nullable(),
});

export const cashflowEntrySchema = z
  .object({
    id: uuidSchema,
    type: cashflowTypeSchema,
    entry_kind: cashflowEntryKindSchema,
    description: z.string(),
    amount: z.union([z.string(), z.number()]),
    payment_method: cashflowPaymentMethodSchema,
    receipt_url: z.string().nullable(),
    date: dateSchema,
    notes: z.string().nullable(),
    created_at: dateTimeSchema,
    deleted_at: dateTimeSchema.nullable(),
    category: cashflowRelationSchema.nullable(),
    program: cashflowRelationSchema.nullable(),
    recorded_by: cashflowRelationSchema.nullable(),
  })
  .openapi("CashflowEntry");

export const cashflowListResponseSchema = createPaginatedSchema(cashflowEntrySchema);

export const cashflowResponseSchema = createSuccessSchema(
  z.object({
    id: uuidSchema,
    type: cashflowTypeSchema,
    entry_kind: cashflowEntryKindSchema,
    category_id: uuidSchema,
    program_id: uuidSchema.nullable(),
    description: z.string(),
    amount: z.union([z.string(), z.number()]),
    payment_method: cashflowPaymentMethodSchema,
    receipt_url: z.string().nullable(),
    source_id: uuidSchema.nullable().optional(),
    recorded_by: uuidSchema,
    updated_by: uuidSchema.nullable().optional(),
    deleted_by: uuidSchema.nullable().optional(),
    date: dateSchema,
    notes: z.string().nullable(),
    created_at: dateTimeSchema,
    updated_at: dateTimeSchema,
    deleted_at: dateTimeSchema.nullable(),
    delete_reason: z.string().nullable().optional(),
  }),
);

export const cashflowDeleteResponseSchema = createSuccessSchema(
  z.object({
    message: z.string(),
  }),
);

export const cashflowSummaryResponseSchema = createSuccessSchema(
  z.object({
    total_income: z.number(),
    total_expense: z.number(),
    net: z.number(),
    balance_by_method: z.record(z.string(), z.number()),
    income_by_category: z.array(
      z.object({
        category: z.string().nullable(),
        amount: z.number(),
      }),
    ),
    expense_by_category: z.array(
      z.object({
        category: z.string().nullable(),
        amount: z.number(),
      }),
    ),
    timeline: z.array(
      z.object({
        period: z.string(),
        income: z.number(),
        expense: z.number(),
      }),
    ),
  }),
);
