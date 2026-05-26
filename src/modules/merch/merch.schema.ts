import { z } from "@hono/zod-openapi";
import {
  createPaginatedSchema,
  createSuccessSchema,
  dateSchema,
  dateTimeSchema,
  idParamSchema,
  uuidSchema,
} from "../../lib/openapi";

export const merchPaymentMethodSchema = z.enum(["bni", "gopay", "cash"]);

export const merchProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
  })
  .openapi("MerchProductsQuery");

export const merchSalesQuerySchema = merchProductsQuerySchema
  .extend({
    product_id: uuidSchema.optional(),
  })
  .openapi("MerchSalesQuery");

export const merchProductPathSchema = idParamSchema.openapi("MerchProductPathParams");

export const createMerchProductRequestSchema = z
  .object({
    name: z.string().min(1),
    merch_line: z.string().min(1).nullable().optional(),
    design_url: z.string().url().nullable().optional(),
    cost_price: z.number().positive(),
    selling_price: z.number().positive(),
    stock: z.number().int().min(0),
  })
  .openapi("CreateMerchProductRequest");

export const updateMerchProductRequestSchema = createMerchProductRequestSchema
  .partial()
  .openapi("UpdateMerchProductRequest");

export const recordMerchSaleRequestSchema = z
  .object({
    product_id: uuidSchema,
    qty: z.number().int().positive(),
    buyer_name: z.string().min(1).nullable().optional(),
    payment_method: merchPaymentMethodSchema,
    receipt_url: z.string().url().nullable().optional(),
  })
  .openapi("RecordMerchSaleRequest");

export const merchProductSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    merchLine: z.string().nullable(),
    designUrl: z.string().nullable(),
    costPrice: z.union([z.string(), z.number()]),
    sellingPrice: z.union([z.string(), z.number()]),
    stock: z.number().int(),
    isActive: z.boolean(),
  })
  .openapi("MerchProduct");

export const merchSaleSchema = z
  .object({
    id: uuidSchema,
    qty: z.number().int(),
    unitPrice: z.union([z.string(), z.number()]),
    totalPrice: z.union([z.string(), z.number()]),
    paymentMethod: merchPaymentMethodSchema,
    receiptUrl: z.string().nullable(),
    date: dateSchema,
    createdAt: dateTimeSchema,
    product: z
      .object({
        id: uuidSchema.nullable(),
        name: z.string().nullable(),
      })
      .nullable(),
    buyerName: z.string().nullable(),
    cashflowId: uuidSchema.nullable(),
  })
  .openapi("MerchSale");

export const merchSaleCreateResponseSchema = createSuccessSchema(
  z.object({
    id: uuidSchema,
    cashflow_id: uuidSchema,
    remaining_stock: z.number().int(),
    qty: z.number().int(),
    total_price: z.union([z.string(), z.number()]),
  }),
);

export const merchSummaryResponseSchema = createSuccessSchema(
  z.array(
    z.object({
      product_id: uuidSchema,
      product_name: z.string(),
      current_stock: z.number().int(),
      total_sold: z.number(),
      total_revenue: z.number(),
    }),
  ),
);

export const merchProductsResponseSchema = createPaginatedSchema(merchProductSchema);
export const merchProductResponseSchema = createSuccessSchema(merchProductSchema);
export const merchProductMutationResponseSchema = createSuccessSchema(
  merchProductSchema.extend({
    createdBy: uuidSchema.nullable().optional(),
    updatedBy: uuidSchema.nullable().optional(),
    deletedBy: uuidSchema.nullable().optional(),
    createdAt: dateTimeSchema.optional(),
    updatedAt: dateTimeSchema.optional(),
    deletedAt: dateTimeSchema.nullable().optional(),
    deleteReason: z.string().nullable().optional(),
  }),
);
export const merchDeleteResponseSchema = createSuccessSchema(
  z.object({
    message: z.string(),
  }),
);
export const merchSalesResponseSchema = createPaginatedSchema(merchSaleSchema);
