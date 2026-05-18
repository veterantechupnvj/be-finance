import { Hono } from "hono";
import { eq, and, isNull, desc, sql, sum, gte, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import {
  finCashflowEntries,
  finCategories,
  finMerchProducts,
  finMerchSales,
} from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { ok, err } from "../../lib/response";
import { writeAudit, writeAuditTx } from "../../lib/audit";
import type { TokenPayload } from "../../lib/jwt";

const router = new Hono();

const createProductSchema = z.object({
  name: z.string().min(1),
  merch_line: z.string().min(1).nullable().optional(),
  design_url: z.string().url().nullable().optional(),
  cost_price: z.number().positive(),
  selling_price: z.number().positive(),
  stock: z.number().int().min(0),
});

const updateProductSchema = createProductSchema.partial();

const recordSaleSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().positive(),
  buyer_name: z.string().min(1).nullable().optional(),
  payment_method: z.enum(["bni", "gopay", "cash"]),
  receipt_url: z.string().url().nullable().optional(),
});

router.get("/products", requireAuth, async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const perPage = Math.min(Number(c.req.query("per_page") ?? 20), 100);

  const where = and(eq(finMerchProducts.isActive, true), isNull(finMerchProducts.deletedAt));

  const [rows, total] = await Promise.all([
    db
      .select({
        id: finMerchProducts.id,
        name: finMerchProducts.name,
        merchLine: finMerchProducts.merchLine,
        designUrl: finMerchProducts.designUrl,
        costPrice: finMerchProducts.costPrice,
        sellingPrice: finMerchProducts.sellingPrice,
        stock: finMerchProducts.stock,
        isActive: finMerchProducts.isActive,
      })
      .from(finMerchProducts)
      .where(where)
      .orderBy(desc(finMerchProducts.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.$count(finMerchProducts, where),
  ]);

  return c.json({
    success: true,
    data: rows,
    meta: {
      total: Number(total),
      page,
      per_page: perPage,
      total_pages: Math.ceil(Number(total) / perPage),
    },
  });
});

router.get("/products/:id", requireAuth, async (c) => {
  const { id } = c.req.param();

  const [product] = await db
    .select({
      id: finMerchProducts.id,
      name: finMerchProducts.name,
      merchLine: finMerchProducts.merchLine,
      designUrl: finMerchProducts.designUrl,
      costPrice: finMerchProducts.costPrice,
      sellingPrice: finMerchProducts.sellingPrice,
      stock: finMerchProducts.stock,
      isActive: finMerchProducts.isActive,
    })
    .from(finMerchProducts)
    .where(
      and(
        eq(finMerchProducts.id, id),
        eq(finMerchProducts.isActive, true),
        isNull(finMerchProducts.deletedAt),
      ),
    )
    .limit(1);

  if (!product) return c.json(err("NOT_FOUND", "Product not found"), 404);

  return c.json(ok(product));
});

router.post("/products", requireAuth, requireRole("finance"), async (c) => {
  const parsed = createProductSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const data = parsed.data;

  const [created] = await db
    .insert(finMerchProducts)
    .values({
      name: data.name,
      merchLine: data.merch_line ?? null,
      designUrl: data.design_url ?? null,
      costPrice: String(data.cost_price),
      sellingPrice: String(data.selling_price),
      stock: data.stock,
      createdBy: user.memberId,
    })
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_merch_products",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
});

router.patch("/products/:id", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const parsed = updateProductSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;

  const [existing] = await db
    .select()
    .from(finMerchProducts)
    .where(and(eq(finMerchProducts.id, id), isNull(finMerchProducts.deletedAt)))
    .limit(1);

  if (!existing) return c.json(err("NOT_FOUND", "Product not found"), 404);

  const data = parsed.data;
  const updates: Partial<typeof finMerchProducts.$inferInsert> = {
    updatedBy: user.memberId,
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.merch_line !== undefined) updates.merchLine = data.merch_line ?? null;
  if (data.design_url !== undefined) updates.designUrl = data.design_url ?? null;
  if (data.cost_price !== undefined) updates.costPrice = String(data.cost_price);
  if (data.selling_price !== undefined) updates.sellingPrice = String(data.selling_price);
  if (data.stock !== undefined) updates.stock = data.stock;

  const [updated] = await db
    .update(finMerchProducts)
    .set(updates)
    .where(eq(finMerchProducts.id, id))
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_merch_products",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated));
});

router.delete("/products/:id", requireAuth, requireRole("finance"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as TokenPayload;

  const [existing] = await db
    .select()
    .from(finMerchProducts)
    .where(and(eq(finMerchProducts.id, id), isNull(finMerchProducts.deletedAt)))
    .limit(1);

  if (!existing) return c.json(err("NOT_FOUND", "Product not found"), 404);

  const [updated] = await db
    .update(finMerchProducts)
    .set({
      isActive: false,
      deletedAt: new Date(),
      deletedBy: user.memberId,
    })
    .where(eq(finMerchProducts.id, id))
    .returning();

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_merch_products",
    entityId: id,
    action: "deleted",
    before: existing,
    after: updated,
  });

  return c.json(ok({ message: "Product deleted" }));
});

router.get("/sales", requireAuth, requireRole("finance"), async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const perPage = Math.min(Number(c.req.query("per_page") ?? 20), 100);
  const productId = c.req.query("product_id");

  const conditions: SQL[] = [isNull(finMerchSales.deletedAt)];
  if (productId) conditions.push(eq(finMerchSales.productId, productId));

  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db
      .select({
        id: finMerchSales.id,
        qty: finMerchSales.qty,
        unitPrice: finMerchSales.unitPrice,
        totalPrice: sql<string>`${finMerchSales.qty} * ${finMerchSales.unitPrice}`,
        paymentMethod: finMerchSales.paymentMethod,
        receiptUrl: finMerchSales.receiptUrl,
        date: finMerchSales.date,
        createdAt: finMerchSales.createdAt,
        product: {
          id: finMerchProducts.id,
          name: finMerchProducts.name,
        },
        buyerName: finMerchSales.buyerName,
        cashflowId: finMerchSales.cashflowEntryId,
      })
      .from(finMerchSales)
      .leftJoin(finMerchProducts, eq(finMerchSales.productId, finMerchProducts.id))
      .where(where)
      .orderBy(desc(finMerchSales.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.$count(finMerchSales, where),
  ]);

  return c.json({
    success: true,
    data: rows,
    meta: {
      total: Number(total),
      page,
      per_page: perPage,
      total_pages: Math.ceil(Number(total) / perPage),
    },
  });
});

router.post("/sales", requireAuth, requireRole("finance"), async (c) => {
  const parsed = recordSaleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json(err("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input"), 422);
  }

  const user = c.get("user") as TokenPayload;
  const data = parsed.data;

  const [product] = await db
    .select()
    .from(finMerchProducts)
    .where(
      and(
        eq(finMerchProducts.id, data.product_id),
        eq(finMerchProducts.isActive, true),
        isNull(finMerchProducts.deletedAt),
      ),
    )
    .limit(1);

  if (!product) return c.json(err("NOT_FOUND", "Product not found"), 404);

  const [category] = await db
    .select({ id: finCategories.id })
    .from(finCategories)
    .where(eq(finCategories.name, "Merchandise"))
    .limit(1);

  if (!category) {
    return c.json(err("INTERNAL_ERROR", "Merchandise category not found - check seed data"), 500);
  }

  const today = new Date().toISOString().split("T")[0];
  const totalPrice = String(Number(product.sellingPrice) * data.qty);

  const sale = await db.transaction(async (tx) => {
    const [updatedProduct] = await tx
      .update(finMerchProducts)
      .set({
        stock: sql`${finMerchProducts.stock} - ${data.qty}`,
        updatedBy: user.memberId,
      })
      .where(and(eq(finMerchProducts.id, product.id), gte(finMerchProducts.stock, data.qty)))
      .returning({ stock: finMerchProducts.stock });

    if (!updatedProduct) {
      throw new Error("Insufficient stock during sale processing");
    }

    const [cashflow] = await tx
      .insert(finCashflowEntries)
      .values({
        type: "income",
        entryKind: "normal",
        categoryId: category.id,
        description: `Merch sale: ${product.name}`,
        amount: totalPrice,
        paymentMethod: data.payment_method,
        receiptUrl: data.receipt_url ?? null,
        recordedBy: user.memberId,
        date: today,
      })
      .returning({ id: finCashflowEntries.id });

    const [createdSale] = await tx
      .insert(finMerchSales)
      .values({
        productId: product.id,
        buyerName: data.buyer_name ?? null,
        qty: data.qty,
        unitPrice: product.sellingPrice,
        paymentMethod: data.payment_method,
        receiptUrl: data.receipt_url ?? null,
        cashflowEntryId: cashflow.id,
        recordedBy: user.memberId,
        date: today,
      })
      .returning();

    await writeAuditTx(tx, {
      actorId: user.memberId,
      entityType: "fin_merch_sales",
      entityId: createdSale.id,
      action: "created",
      after: createdSale,
    });

    return {
      id: createdSale.id,
      cashflow_id: cashflow.id,
      remaining_stock: updatedProduct.stock,
      qty: createdSale.qty,
      total_price: totalPrice,
    };
  });

  return c.json(ok(sale), 201);
});

router.get("/summary", requireAuth, requireRole("finance"), async (c) => {
  const rows = await db
    .select({
      productId: finMerchProducts.id,
      productName: finMerchProducts.name,
      currentStock: finMerchProducts.stock,
      totalSold: sum(finMerchSales.qty),
      totalRevenue: sql<string>`SUM(${finMerchSales.qty} * ${finMerchSales.unitPrice})`,
    })
    .from(finMerchProducts)
    .leftJoin(finMerchSales, eq(finMerchProducts.id, finMerchSales.productId))
    .where(isNull(finMerchProducts.deletedAt))
    .groupBy(finMerchProducts.id, finMerchProducts.name, finMerchProducts.stock)
    .orderBy(desc(sql`SUM(${finMerchSales.qty} * ${finMerchSales.unitPrice})`));

  return c.json(
    ok(
      rows.map((r) => ({
        product_id: r.productId,
        product_name: r.productName,
        current_stock: r.currentStock,
        total_sold: Number(r.totalSold ?? 0),
        total_revenue: Number(r.totalRevenue ?? 0),
      })),
    ),
  );
});

export default router;
