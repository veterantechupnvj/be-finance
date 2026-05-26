import { z } from "@hono/zod-openapi";
import {
  createSuccessSchema,
  dateTimeSchema,
  memberIdParamSchema,
  uuidSchema,
} from "../../lib/openapi";

export const duesStatusSchema = z.enum(["unpaid", "pending", "verified", "exempt"]);
export const duesPaymentMethodSchema = z.enum(["bni", "gopay", "cash"]);
export const duesLeniencyTypeSchema = z.enum(["none", "reduced_fixed", "reduced_temporary"]);

export const duesListQuerySchema = z
  .object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().optional(),
    status: duesStatusSchema.optional(),
    member_id: uuidSchema.optional(),
  })
  .openapi("DuesListQuery");

export const duesMeQuerySchema = z
  .object({
    year: z.coerce.number().int().optional(),
  })
  .openapi("DuesMeQuery");

export const duesPathSchema = z
  .object({
    id: uuidSchema,
  })
  .openapi("DuesPathParams");

export const payDuesRequestSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020),
    payment_method: duesPaymentMethodSchema,
    receipt_url: z.string().url(),
  })
  .openapi("PayDuesRequest");

export const exemptDuesRequestSchema = z
  .object({
    exempt_reason: z.string().min(1),
  })
  .openapi("ExemptDuesRequest");

export const duesConfigRequestSchema = z
  .object({
    member_id: uuidSchema,
    staff_period_id: uuidSchema,
    monthly_amount: z.number().positive(),
    leniency_type: duesLeniencyTypeSchema,
    leniency_start: z.string().date().nullable().optional(),
    leniency_end: z.string().date().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .openapi("DuesConfigRequest");

export const duesMemberSchema = z.object({
  id: uuidSchema.nullable(),
  name: z.string().nullable(),
  nim: z.string().nullable(),
});

export const duesRecordSchema = z
  .object({
    id: uuidSchema,
    month: z.number().int(),
    year: z.number().int(),
    amount: z.union([z.string(), z.number()]),
    status: duesStatusSchema,
    paymentMethod: duesPaymentMethodSchema.nullable(),
    receiptUrl: z.string().nullable(),
    paidAt: dateTimeSchema.nullable(),
    verifiedAt: dateTimeSchema.nullable(),
    exemptReason: z.string().nullable(),
    member: duesMemberSchema.nullable().optional(),
    verifiedBy: uuidSchema.nullable().optional(),
  })
  .openapi("DuesRecord");

export const duesConfigSchema = z
  .object({
    id: uuidSchema,
    staffPeriodId: uuidSchema,
    memberId: uuidSchema,
    monthlyAmount: z.union([z.string(), z.number()]),
    leniencyType: duesLeniencyTypeSchema,
    leniencyStart: z.string().date().nullable(),
    leniencyEnd: z.string().date().nullable(),
    notes: z.string().nullable(),
    configuredBy: uuidSchema,
    updatedBy: uuidSchema.nullable(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .openapi("DuesConfig");

export const duesListResponseSchema = createSuccessSchema(z.array(duesRecordSchema));
export const duesMeResponseSchema = createSuccessSchema(
  z.array(
    duesRecordSchema.pick({
      id: true,
      month: true,
      year: true,
      amount: true,
      status: true,
      paymentMethod: true,
      receiptUrl: true,
      paidAt: true,
      exemptReason: true,
    }),
  ),
);
export const payDuesResponseSchema = createSuccessSchema(
  z.object({
    id: uuidSchema,
    month: z.number().int(),
    year: z.number().int(),
    status: duesStatusSchema,
    message: z.string(),
  }),
);
export const verifyDuesResponseSchema = createSuccessSchema(
  z.object({
    id: uuidSchema,
    status: z.literal("verified"),
    message: z.string(),
  }),
);
export const exemptDuesResponseSchema = createSuccessSchema(
  duesConfigSchema.partial().and(duesRecordSchema),
);
export const duesConfigListResponseSchema = createSuccessSchema(z.array(duesConfigSchema));
export const duesConfigResponseSchema = createSuccessSchema(duesConfigSchema);
export const duesConfigPathSchema = memberIdParamSchema.openapi("DuesConfigPathParams");
