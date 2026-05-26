# VeteranTech API - Conventions

> Paste the relevant section of this file at the start of every AI prompt to keep output consistent.
> For full architectural rules and golden rules, see `AGENTS.md`.

---

## Tech Stack

- **Runtime:** Bun
- **Framework:** Hono + `@hono/zod-openapi`
- **API Docs:** Scalar (`@scalar/hono-api-reference`)
- **ORM:** Drizzle ORM (PostgreSQL)
- **Auth:** Custom JWT — NIM + password (`src/lib/jwt.ts` + `users` table)
- **Validation:** Zod
- **Database:** PostgreSQL 16

---

## Project Structure

```
src/
├── db/
│   ├── schema/          # one file per domain
│   ├── migrations/      # drizzle-kit generated — do not edit manually
│   └── index.ts         # drizzle client singleton
├── lib/
│   ├── audit.ts
│   ├── auth.ts
│   ├── jwt.ts
│   └── response.ts
├── middleware/
│   ├── auth.ts
│   ├── error-handler.ts
│   └── rbac.ts
├── modules/
│   └── [domain]/
│       ├── [domain].routes.ts    # createRoute() definitions
│       ├── [domain].handlers.ts  # thin handlers, call service if needed
│       ├── [domain].schema.ts    # Zod schemas (request/response)
│       ├── [domain].service.ts   # only if multi-table or transaction needed
│       └── index.ts              # createRouter() + mount routes
├── app.ts               # register all modules, middleware, OpenAPI spec
├── factory.ts           # createRouter(), AppEnv, AppContext
├── env.ts               # Zod env schema & Env type
└── index.ts             # entry point only — import app; export default app
```

### Rules

- One module per domain.
- Keep handlers thin — business logic goes in `*.service.ts`.
- Create a service file only when a handler touches more than one table or needs a DB transaction.
- Multi-table mutations must use `db.transaction()`.
- Audit writes must use the same transaction executor as the main mutation.
- Schema files must stay aligned with the API contract before new routes are added.
- Never use `new Hono()` — always `createRouter()` from `src/factory.ts`.
- All production routes must use `createRoute()` + `router.openapi()`.

---

## Naming Conventions

| Context                  | Style                | Example                             |
| ------------------------ | -------------------- | ----------------------------------- |
| DB tables                | `snake_case`         | `fin_cashflow_entries`              |
| DB columns               | `snake_case`         | `created_at`, `member_id`           |
| API endpoints            | `kebab-case`         | `/finance/cashflow-entries`         |
| API request fields       | `snake_case`         | `cost_price`, `buyer_name`          |
| API response fields      | `snake_case`         | `cashflow_id`, `remaining_stock`    |
| TS variables / functions | `camelCase`          | `memberId`, `getHandler`            |
| TS types / interfaces    | `PascalCase`         | `TokenPayload`, `AppEnv`            |
| Files                    | `kebab-case`         | `cashflow.ts`, `error-handler.ts`   |
| Module files             | `[domain].[role].ts` | `dues.service.ts`, `dues.routes.ts` |

---

## API Response Format

### Success

```json
{ "success": true, "data": {} }
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message"
  }
}
```

### Standard Error Codes

| Code               | HTTP | When                                        |
| ------------------ | ---- | ------------------------------------------- |
| `VALIDATION_ERROR` | 422  | Invalid request body/params                 |
| `UNAUTHORIZED`     | 401  | Missing or invalid JWT                      |
| `FORBIDDEN`        | 403  | Valid JWT but insufficient role             |
| `NOT_FOUND`        | 404  | Resource does not exist                     |
| `CONFLICT`         | 409  | Duplicate entry or invalid state transition |
| `INTERNAL_ERROR`   | 500  | Unexpected server error                     |

---

## Auth Conventions

- Login uses `nim` + password — no email, no OAuth.
- Passwords stored as `password_hash` only — never plaintext.
- All protected routes require `Authorization: Bearer <token>`.
- `must_change_password` enforced in auth middleware.
- JWT payload must contain: `sub`, `memberId`, `nim`, `roles`, `mustChangePassword`.

---

## RBAC Conventions

- MVP roles: `finance` and `member`.
- Route protection uses `requireRole(...)` middleware.
- Only `finance` can mutate finance resources.
- `member` can access read-only transparency endpoints + submit their own requests.

---

## Drizzle Conventions

- Every table has a UUID primary key (`gen_random_uuid()`).
- Every table has `created_at` and `updated_at`.
- Tables supporting deletion use soft delete: `deleted_at`, `deleted_by`, `delete_reason`.
- Finance queries must exclude soft-deleted rows by default.
- **Money is stored as `numeric`/`decimal` — never `float`.**
- Timestamps in OpenAPI schemas: `z.string().datetime()` — never `z.date()`.
- Always validate destructured Drizzle returns before accessing properties:

```typescript
const [row] = await db.insert(table).values(data).returning();
if (!row) throw new Error("Insert failed");
```
