import { and, desc, eq, gte, isNull, sql, sum, type SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  finCashflowEntries,
  finCategories,
  finMerchProducts,
  finMerchSales,
} from "../../db/schema";
import { writeAudit, writeAuditTx } from "../../lib/audit";
import { err, ok } from "../../lib/response";
import type { AppRouteHandler } from "../../lib/route-handler";
import {
  createMerchProductRoute,
  createMerchSaleRoute,
  deleteMerchProductRoute,
  getMerchProductRoute,
  listMerchProductsRoute,
  listMerchSalesRoute,
  merchSummaryRoute,
  updateMerchProductRoute,
} from "./merch.routes";

export const listMerchProductsHandler: AppRouteHandler<typeof listMerchProductsRoute> = async (
  c,
) => {
  const query = c.req.valid("query");
  const page = query.page ?? 1;
  const perPage = Math.min(query.per_page ?? 20, 100);
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

  const count = Number(total);

  return c.json(
    {
      success: true,
      data: rows,
      meta: {
        total: count,
        page,
        per_page: perPage,
        total_pages: Math.ceil(count / perPage),
      },
    },
    200,
  );
};

export const getMerchProductHandler: AppRouteHandler<typeof getMerchProductRoute> = async (c) => {
  const { id } = c.req.valid("param");

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

  if (!product) {
    return c.json(err("NOT_FOUND", "Product not found"), 404);
  }

  return c.json(ok(product), 200);
};

export const createMerchProductHandler: AppRouteHandler<typeof createMerchProductRoute> = async (
  c,
) => {
  const user = c.get("user");
  const data = c.req.valid("json");

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

  if (!created) {
    return c.json(err("INTERNAL_ERROR", "Failed to create product"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_merch_products",
    entityId: created.id,
    action: "created",
    after: created,
  });

  return c.json(ok(created), 201);
};

export const updateMerchProductHandler: AppRouteHandler<typeof updateMerchProductRoute> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(finMerchProducts)
    .where(and(eq(finMerchProducts.id, id), isNull(finMerchProducts.deletedAt)))
    .limit(1);

  if (!existing) {
    return c.json(err("NOT_FOUND", "Product not found"), 404);
  }

  const updates: Partial<typeof finMerchProducts.$inferInsert> = {
    updatedBy: user.memberId,
  };
  if (data.name !== undefined) {
    updates.name = data.name;
  }
  if (data.merch_line !== undefined) {
    updates.merchLine = data.merch_line ?? null;
  }
  if (data.design_url !== undefined) {
    updates.designUrl = data.design_url ?? null;
  }
  if (data.cost_price !== undefined) {
    updates.costPrice = String(data.cost_price);
  }
  if (data.selling_price !== undefined) {
    updates.sellingPrice = String(data.selling_price);
  }
  if (data.stock !== undefined) {
    updates.stock = data.stock;
  }

  const [updated] = await db
    .update(finMerchProducts)
    .set(updates)
    .where(eq(finMerchProducts.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to update product"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_merch_products",
    entityId: id,
    action: "updated",
    before: existing,
    after: updated,
  });

  return c.json(ok(updated), 200);
};

export const deleteMerchProductHandler: AppRouteHandler<typeof deleteMerchProductRoute> = async (
  c,
) => {
  const user = c.get("user");
  const { id } = c.req.valid("param");

  const [existing] = await db
    .select()
    .from(finMerchProducts)
    .where(and(eq(finMerchProducts.id, id), isNull(finMerchProducts.deletedAt)))
    .limit(1);

  if (!existing) {
    return c.json(err("NOT_FOUND", "Product not found"), 404);
  }

  const [updated] = await db
    .update(finMerchProducts)
    .set({
      isActive: false,
      deletedAt: new Date(),
      deletedBy: user.memberId,
    })
    .where(eq(finMerchProducts.id, id))
    .returning();

  if (!updated) {
    return c.json(err("INTERNAL_ERROR", "Failed to delete product"), 500);
  }

  await writeAudit({
    actorId: user.memberId,
    entityType: "fin_merch_products",
    entityId: id,
    action: "deleted",
    before: existing,
    after: updated,
  });

  return c.json(ok({ message: "Product deleted" }), 200);
};

export const listMerchSalesHandler: AppRouteHandler<typeof listMerchSalesRoute> = async (c) => {
  const query = c.req.valid("query");
  const page = query.page ?? 1;
  const perPage = Math.min(query.per_page ?? 20, 100);

  const conditions: SQL[] = [isNull(finMerchSales.deletedAt)];
  if (query.product_id) {
    conditions.push(eq(finMerchSales.productId, query.product_id));
  }

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

  const count = Number(total);

  return c.json(
    {
      success: true,
      data: rows,
      meta: {
        total: count,
        page,
        per_page: perPage,
        total_pages: Math.ceil(count / perPage),
      },
    },
    200,
  );
};

export const createMerchSaleHandler: AppRouteHandler<typeof createMerchSaleRoute> = async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

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

  if (!product) {
    return c.json(err("NOT_FOUND", "Product not found"), 404);
  }

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

    if (!cashflow) {
      throw new Error("Failed to create cashflow entry for merch sale");
    }

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

    if (!createdSale) {
      throw new Error("Failed to create merch sale");
    }

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
};

export const merchSummaryHandler: AppRouteHandler<typeof merchSummaryRoute> = async (c) => {
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
      rows.map((row) => ({
        product_id: row.productId,
        product_name: row.productName,
        current_stock: row.currentStock,
        total_sold: Number(row.totalSold ?? 0),
        total_revenue: Number(row.totalRevenue ?? 0),
      })),
    ),
    200,
  );
};
