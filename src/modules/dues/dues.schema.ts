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
    payment_method: duesPaymentMethodSchema.nullable(),
    receipt_url: z.string().nullable(),
    paid_at: dateTimeSchema.nullable(),
    verified_at: dateTimeSchema.nullable(),
    exempt_reason: z.string().nullable(),
    member: duesMemberSchema.nullable().optional(),
    verified_by: uuidSchema.nullable().optional(),
  })
  .openapi("DuesRecord");

export const duesConfigSchema = z
  .object({
    id: uuidSchema,
    staff_period_id: uuidSchema,
    member_id: uuidSchema,
    monthly_amount: z.union([z.string(), z.number()]),
    leniency_type: duesLeniencyTypeSchema,
    leniency_start: z.string().date().nullable(),
    leniency_end: z.string().date().nullable(),
    notes: z.string().nullable(),
    configured_by: uuidSchema,
    updated_by: uuidSchema.nullable(),
    created_at: dateTimeSchema,
    updated_at: dateTimeSchema,
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
      payment_method: true,
      receipt_url: true,
      paid_at: true,
      exempt_reason: true,
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
export const exemptDuesResponseSchema = createSuccessSchema(duesRecordSchema);
export const duesConfigListResponseSchema = createSuccessSchema(z.array(duesConfigSchema));
export const duesConfigResponseSchema = createSuccessSchema(duesConfigSchema);
export const duesConfigPathSchema = memberIdParamSchema.openapi("DuesConfigPathParams");
