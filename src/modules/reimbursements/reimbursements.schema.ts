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
    activityTitle: z.string(),
    amount: z.union([z.string(), z.number()]),
    status: reimbursementStatusSchema,
    paymentDestination: reimbursementPaymentDestinationSchema,
    accountInfo: z.string(),
    purchaseReceiptUrl: z.string(),
    transferReceiptUrl: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    approvedAt: dateTimeSchema.nullable(),
    paidAt: dateTimeSchema.nullable(),
    createdAt: dateTimeSchema,
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
    memberId: uuidSchema,
    audit_trail: z.array(reimbursementAuditEntrySchema),
  })
  .openapi("ReimbursementDetail");

export const reimbursementMutationSchema = z
  .object({
    id: uuidSchema,
    memberId: uuidSchema,
    programId: uuidSchema.nullable(),
    categoryId: uuidSchema,
    activityTitle: z.string(),
    description: z.string().nullable(),
    amount: z.union([z.string(), z.number()]),
    purchaseReceiptUrl: z.string(),
    paymentDestination: reimbursementPaymentDestinationSchema,
    accountInfo: z.string(),
    status: reimbursementStatusSchema,
    rejectionReason: z.string().nullable(),
    approvedBy: uuidSchema.nullable(),
    approvedAt: dateTimeSchema.nullable(),
    transferReceiptUrl: z.string().nullable(),
    paidAt: dateTimeSchema.nullable(),
    cashflowEntryId: uuidSchema.nullable(),
    createdBy: uuidSchema,
    updatedBy: uuidSchema.nullable(),
    deletedBy: uuidSchema.nullable(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    deletedAt: dateTimeSchema.nullable(),
    deleteReason: z.string().nullable(),
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
      activityTitle: true,
      amount: true,
      status: true,
      purchaseReceiptUrl: true,
      transferReceiptUrl: true,
      rejectionReason: true,
      createdAt: true,
      category: true,
    }),
  ),
);
export const reimbursementDetailResponseSchema = createSuccessSchema(reimbursementDetailSchema);
export const reimbursementMutationResponseSchema = createSuccessSchema(reimbursementMutationSchema);
