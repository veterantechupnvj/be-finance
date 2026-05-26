# AGENTS.md - Project Context & Directives

> **SYSTEM INSTRUCTION:** ALL AI AGENTS WORKING ON THIS REPOSITORY MUST READ AND ADHERE TO THE FOLLOWING ARCHITECTURAL GUIDELINES. DO NOT DEVIATE WITHOUT EXPLICIT USER OVERRIDE.

---

## 1. Project Overview

**Project:** `be-finance` — VeteranTech Finance Dashboard Backend  
**Goal:** Shared backend API for VeteranTech's modular ERP system. Finance Dashboard is the first client; future modules (HR/Peops, Marcomms, etc.) will consume the same API and database.  
**Org:** `veterantechupnvj`

---

## 2. Tech Stack (Strict)

| Layer      | Tech                                                            |
| ---------- | --------------------------------------------------------------- |
| Runtime    | **Bun** (NOT Cloudflare Workers, NOT Node.js)                   |
| Framework  | Hono v4+                                                        |
| OpenAPI    | `@hono/zod-openapi` + Scalar                                    |
| Auth       | Custom JWT — NIM + password (NOT Better Auth, NOT Google OAuth) |
| ORM        | Drizzle ORM                                                     |
| Database   | PostgreSQL 16                                                   |
| Validation | Zod                                                             |
| Language   | TypeScript (strict)                                             |
| Linting    | Oxlint & Oxfmt                                                  |
| Deployment | VPS + Dokploy, image hosted on GHCR                             |

> ⚠️ This runs on **Bun**, not Cloudflare Workers. `process.env` is accessible but environment variables should be passed explicitly — never read `process.env` directly inside handlers or services.

---

## 3. Architecture & Core Philosophy

**Modular Monolith** with clear layer separation:

- **Modules:** Vertical slices per domain (`auth`, `members`, `dues`, `cashflow`, etc.)
- **Services:** Pure business logic — no Hono Context passed in, primitives only
- **Factory:** Single source of truth for router creation

This is a **smart cashflow tracker + member management system**, not a full double-entry accounting system. Think GoPay/MyBCA UX, not SAP.

---

## 4. The Golden Rules (Violations = Immediate Rejection)

### Rule 1: The Factory Rule

**NEVER** use `new Hono()` or `new OpenAPIHono()` directly in any module. **ALWAYS** use `createRouter()` from `src/factory.ts`.

```typescript
// ✅ GOOD
import { createRouter } from "@/factory";
const router = createRouter();

// ❌ BAD
import { Hono } from "hono";
const router = new Hono();
```

### Rule 2: The OpenAPI Documentation Rule

**ALWAYS** use `createRoute()` + `router.openapi()` for every production route. **NEVER** use bare `router.get()` / `router.post()`.

Every `createRoute()` MUST have: `method`, `path`, `tags`, `summary`, `responses`.

```typescript
// ✅ GOOD
const route = createRoute({
  method: "get",
  path: "/finance/dues",
  tags: ["Dues"],
  summary: "List all member dues",
  responses: {
    200: { content: { "application/json": { schema: ResponseSchema } }, description: "OK" },
  },
});
router.openapi(route, handler);

// ❌ BAD
router.get("/finance/dues", handler);
```

### Rule 3: The Validation Rule

**ALWAYS** define request schemas inside `createRoute()` using `request.body`, `request.params`, or `request.query`. Data is validated automatically by the framework.

```typescript
router.openapi(route, async (c) => {
  const { member_id, month } = c.req.valid("json"); // ← already validated & typed
});
```

### Rule 4: The Service Purity Rule

Services must be testable without Hono. **NEVER** pass Hono `Context` (`c`) to a service. Pass primitives and plain objects only.

```typescript
// ✅ GOOD
export async function approveReimbursement(
  db: DrizzleDb,
  reimbursementId: string,
  approvedBy: string
): Promise<void> { ... }

// ❌ BAD
export async function approveReimbursement(c: Context) { ... }
```

### Rule 5: The Zod ISO Date Rule

Use `z.string().datetime()` for timestamp fields in OpenAPI schemas. **NEVER** use `z.date()`.

```typescript
// ✅ GOOD
z.object({ created_at: z.string().datetime() });

// ❌ BAD
z.object({ created_at: z.date() }); // breaks OpenAPI generation
```

### Rule 6: The Money Rule

**NEVER** use `float` or `number` for monetary values in the database schema. Always use `numeric` / `decimal`.

```typescript
// ✅ GOOD
nominal: decimal("nominal", { precision: 15, scale: 2 }).notNull();

// ❌ BAD
nominal: real("nominal").notNull();
```

### Rule 7: The Drizzle Destructure Rule

**ALWAYS** validate destructured Drizzle returns before accessing properties.

```typescript
// ✅ GOOD
const [inserted] = await db.insert(table).values(data).returning();
if (!inserted) throw new Error("Insert failed");
return inserted.id;

// ❌ BAD
const [inserted] = await db.insert(table).values(data).returning();
return inserted.id; // inserted may be undefined
```

### Rule 8: The Import Direction Rule

- `modules/` → may import → `db/schema/`, `lib/`, `middleware/`
- `services/` → may import → `db/schema/`, `lib/`
- ❌ `modules/A` → imports → `modules/B` — use shared `lib/` instead

---

## 5. Directory Structure

```
src/
├── index.ts               # Entry point only — import app; export default app
├── app.ts                 # Mount all modules, middleware, OpenAPI spec, Scalar UI
├── factory.ts             # createRouter(), AppEnv, AppContext types
├── env.ts                 # Zod env schema & Env type
│
├── db/
│   ├── schema/            # One file per domain (members.ts, finance.ts, auth.ts)
│   ├── migrations/        # drizzle-kit generated — DO NOT edit manually
│   └── index.ts           # Drizzle client singleton
│
├── lib/
│   ├── jwt.ts             # sign + verify JWT
│   ├── auth.ts            # Password hashing helpers
│   ├── audit.ts           # audit_events writer
│   └── response.ts        # c.json success/error helpers
│
├── middleware/
│   ├── auth.ts            # JWT verify, inject member into context
│   ├── rbac.ts            # requireRole('finance' | 'member')
│   └── error-handler.ts   # Global error handler
│
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.handlers.ts
│   │   ├── auth.schema.ts
│   │   └── index.ts
│   ├── members/
│   ├── dues/              # has dues.service.ts (verify → cashflow → audit)
│   ├── cashflow/
│   ├── reimbursements/    # has reimbursements.service.ts (approve → cashflow → audit)
│   ├── merch/             # has merch.service.ts (sale → stock deduct → cashflow)
│   ├── categories/
│   └── programs/
│
└── scripts/
    └── seed-dev.ts
```

### When to create a `*.service.ts`

Create a service file **only when** the handler needs to:

- Touch more than one table in a single operation
- Use a DB transaction
- Share the same logic across multiple handlers

Simple single-table CRUD → write directly in the handler, no service needed.

---

## 6. Naming Conventions

| Context                     | Style                | Example                             |
| --------------------------- | -------------------- | ----------------------------------- |
| DB tables                   | `snake_case`         | `fin_cashflow_entries`              |
| DB columns                  | `snake_case`         | `created_at`, `member_id`           |
| API endpoints               | `kebab-case`         | `/finance/cashflow-entries`         |
| API request/response fields | `snake_case`         | `cost_price`, `buyer_name`          |
| TS variables / functions    | `camelCase`          | `memberId`, `getHandler`            |
| TS types / interfaces       | `PascalCase`         | `TokenPayload`, `AppEnv`            |
| Files                       | `kebab-case`         | `cashflow.ts`, `error-handler.ts`   |
| Module files                | `[domain].[role].ts` | `dues.service.ts`, `dues.routes.ts` |

---

## 7. API Response Format

All responses MUST use this format (via helpers in `src/lib/response.ts`):

### Success

```json
{ "success": true, "data": {} }
```

### Error

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Human-readable message" } }
```

### Standard Error Codes

| Code               | HTTP | When                                  |
| ------------------ | ---- | ------------------------------------- |
| `VALIDATION_ERROR` | 422  | Invalid request body / params         |
| `UNAUTHORIZED`     | 401  | Missing or invalid JWT                |
| `FORBIDDEN`        | 403  | Valid JWT but insufficient role       |
| `NOT_FOUND`        | 404  | Resource does not exist               |
| `CONFLICT`         | 409  | Duplicate or invalid state transition |
| `INTERNAL_ERROR`   | 500  | Unexpected server error               |

---

## 8. Auth & RBAC

- Login uses `nim` + `password` — no email, no Google OAuth
- Passwords stored as `password_hash` only — never plaintext
- All protected routes require `Authorization: Bearer <token>`
- `must_change_password` enforced in auth middleware
- JWT payload must contain: `sub`, `memberId`, `nim`, `roles`, `mustChangePassword`
- MVP roles: `finance` and `member`
- Only `finance` can mutate finance resources
- `member` can access read-only transparency endpoints + submit their own requests

---

## 9. Multi-Step Workflows (Must Use DB Transaction)

| Operation               | Tables touched                                                            |
| ----------------------- | ------------------------------------------------------------------------- |
| Verify member dues      | `fin_member_dues` + `fin_cashflow_entries` + `audit_events`               |
| Approve reimbursement   | `fin_reimbursement_requests` + `audit_events`                             |
| Mark reimbursement paid | `fin_reimbursement_requests` + `fin_cashflow_entries` + `audit_events`    |
| Record merch sale       | `fin_merch_sales` + `fin_merch_products` (stock) + `fin_cashflow_entries` |

```typescript
await db.transaction(async (tx) => {
  // all operations use tx, not db
});
```

---

## 10. Domain Modules Reference

| Module         | OpenAPI Tag      | Route Prefix              |
| -------------- | ---------------- | ------------------------- |
| auth           | `Auth`           | `/auth`                   |
| members        | `Members`        | `/members`                |
| dues           | `Dues`           | `/finance/dues`           |
| cashflow       | `Cashflow`       | `/finance/cashflow`       |
| reimbursements | `Reimbursements` | `/finance/reimbursements` |
| merch          | `Merch`          | `/finance/merch`          |
| categories     | `Categories`     | `/finance/categories`     |
| programs       | `Programs`       | `/finance/programs`       |

---

## 11. Development Workflow (Adding a New Feature)

### Phase 1: Data

1. Update `src/db/schema/` with new table or columns
2. `bun run db:generate` → `bun run db:migrate`

### Phase 2: Contract

3. Create `src/modules/[domain]/[name].schema.ts` with Zod schemas
4. Create `src/modules/[domain]/[name].routes.ts` with `createRoute()`

### Phase 3: Logic

5. Create `src/modules/[domain]/[name].handlers.ts`
6. If multi-table: create `src/modules/[domain]/[name].service.ts`
7. Create `src/modules/[domain]/index.ts` — `createRouter()` + mount routes
8. Register module in `src/app.ts`

### Phase 4: Docs

9. `bun run openapi:generate` to update OpenAPI spec

---

## 12. Code Quality Checklist

Before every commit:

```bash
bun run fl     # format + lint
bun run check  # TypeScript type check
```

- ✅ No `new Hono()` or `new OpenAPIHono()` — use `createRouter()`
- ✅ All production routes use `createRoute()` + `router.openapi()`
- ✅ No `z.date()` in OpenAPI schemas — use `z.string().datetime()`
- ✅ No `as any` or `: any`
- ✅ Services do not receive Hono Context
- ✅ No cross-module imports
- ✅ Money fields use `decimal`, never `float`
- ✅ Drizzle destructured results validated before property access
- ✅ Multi-table mutations wrapped in `db.transaction()`

---

## 13. Reference Files

- `CONVENTIONS.md` — naming, response format, RBAC summary
- `src/db/schema/` — canonical data model, source of truth for all entities
- `docs/` — ERD and supplementary documentation
