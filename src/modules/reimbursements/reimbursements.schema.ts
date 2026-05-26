import { z } from "@hono/zod-openapi";
import { createSuccessSchema, dateTimeSchema, idParamSchema, uuidSchema } from "../../lib/openapi";

export const reimbursementStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "rejected",
  "paid",
  "cancelled",
]);
export const reimbursementPaymentDestinationSchema = z.enum(["bni", "gopay"]);

export const reimbursementsListQuerySchema = z
  .object({
    status: reimbursementStatusSchema.optional(),
    member_id: uuidSchema.optional(),
    program_id: uuidSchema.optional(),
  })
  .openapi("ReimbursementsListQuery");

export const reimbursementPathSchema = idParamSchema.openapi("ReimbursementPathParams");

export const createReimbursementRequestSchema = z
  .object({
    activity_title: z.string().min(1),
    category_id: uuidSchema,
    program_id: uuidSchema.nullable().optional(),
    description: z.string().nullable().optional(),
    amount: z.number().positive(),
    purchase_receipt_url: z.string().url(),
    payment_destination: reimbursementPaymentDestinationSchema,
    account_info: z.string().min(1),
  })
  .openapi("CreateReimbursementRequest");

export const rejectReimbursementRequestSchema = z
  .object({
    reason: z.string().min(1),
  })
  .openapi("RejectReimbursementRequest");

export const markPaidRequestSchema = z
  .object({
    transfer_receipt_url: z.string().url(),
  })
  .openapi("MarkReimbursementPaidRequest");

export const reimbursementActorSchema = z.object({
  id: uuidSchema,
  name: z.string(),
});

export const reimbursementAuditEntrySchema = z.object({
  action: z.string(),
  actor: reimbursementActorSchema.nullable(),
  at: dateTimeSchema,
  notes: z.string().nullable(),
});

export const reimbursementListItemSchema = z
  .object({
    id: uuidSchema,
    activity_title: z.string(),
    amount: z.union([z.string(), z.number()]),
    status: reimbursementStatusSchema,
    payment_destination: reimbursementPaymentDestinationSchema,
    account_info: z.string(),
    purchase_receipt_url: z.string(),
    transfer_receipt_url: z.string().nullable(),
    rejection_reason: z.string().nullable(),
    approved_at: dateTimeSchema.nullable(),
    paid_at: dateTimeSchema.nullable(),
    created_at: dateTimeSchema,
    member: z
      .object({
        id: uuidSchema.nullable(),
        name: z.string().nullable(),
        nim: z.string().nullable(),
      })
      .nullable()
      .optional(),
    category: z
      .object({
        id: uuidSchema.nullable(),
        name: z.string().nullable(),
      })
      .nullable()
      .optional(),
    program: z
      .object({
        id: uuidSchema.nullable(),
        name: z.string().nullable(),
      })
      .nullable()
      .optional(),
  })
  .openapi("ReimbursementListItem");

export const reimbursementDetailSchema = reimbursementListItemSchema
  .extend({
    description: z.string().nullable(),
    member_id: uuidSchema,
    audit_trail: z.array(reimbursementAuditEntrySchema),
  })
  .openapi("ReimbursementDetail");

export const reimbursementMutationSchema = z
  .object({
    id: uuidSchema,
    member_id: uuidSchema,
    program_id: uuidSchema.nullable(),
    category_id: uuidSchema,
    activity_title: z.string(),
    description: z.string().nullable(),
    amount: z.union([z.string(), z.number()]),
    purchase_receipt_url: z.string(),
    payment_destination: reimbursementPaymentDestinationSchema,
    account_info: z.string(),
    status: reimbursementStatusSchema,
    rejection_reason: z.string().nullable(),
    approved_by: uuidSchema.nullable(),
    approved_at: dateTimeSchema.nullable(),
    transfer_receipt_url: z.string().nullable(),
    paid_at: dateTimeSchema.nullable(),
    cashflow_entry_id: uuidSchema.nullable(),
    created_by: uuidSchema,
    updated_by: uuidSchema.nullable(),
    deleted_by: uuidSchema.nullable(),
    created_at: dateTimeSchema,
    updated_at: dateTimeSchema,
    deleted_at: dateTimeSchema.nullable(),
    delete_reason: z.string().nullable(),
  })
  .openapi("ReimbursementMutation");

export const reimbursementStatusResponseSchema = createSuccessSchema(
  z.object({
    id: uuidSchema,
    status: z.string(),
    cashflow_entry_created: z.boolean().optional(),
  }),
);

export const reimbursementsResponseSchema = createSuccessSchema(
  z.array(reimbursementListItemSchema),
);
export const myReimbursementsResponseSchema = createSuccessSchema(
  z.array(
    reimbursementListItemSchema.pick({
      id: true,
      activity_title: true,
      amount: true,
      status: true,
      purchase_receipt_url: true,
      transfer_receipt_url: true,
      rejection_reason: true,
      created_at: true,
      category: true,
    }),
  ),
);
export const reimbursementDetailResponseSchema = createSuccessSchema(reimbursementDetailSchema);
export const reimbursementMutationResponseSchema = createSuccessSchema(reimbursementMutationSchema);
