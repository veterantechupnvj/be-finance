# VeteranTech API - Conventions

> Paste the relevant section of this file at the start of every AI prompt to keep output consistent.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Hono
- **ORM:** Drizzle ORM (PostgreSQL)
- **Auth:** Custom JWT auth (`src/lib/jwt.ts` + `users` table)
- **Validation:** Zod
- **Database:** PostgreSQL 15+

---

## Project Structure

src/
|- db/
| |- schema/ # one file per domain
| |- migrations/ # drizzle-kit generated
| `- index.ts         # drizzle client
|- routes/
|  |- auth.ts
|  `- finance/
| |- categories.ts
| |- cashflow.ts
| |- dues.ts
| |- merch.ts
| |- programs.ts
| `- reimbursements.ts
|- middleware/
|  |- auth.ts
|  |- error-handler.ts
|  `- rbac.ts
|- lib/
| |- audit.ts
| |- auth.ts
| |- jwt.ts
| `- response.ts
`- index.ts

### Rules

- One route file per domain.
- Keep route handlers thin.
- Multi-step workflows that touch multiple tables should live in `services/` and accept a DB transaction.
- Audit writes for multi-step mutations should use the same transaction executor as the main workflow.
- Schema files should stay aligned with the API contract before new routes are added.

---

## Naming Conventions

| Context             | Style          | Example                          |
| ------------------- | -------------- | -------------------------------- |
| DB tables           | `snake_case`   | `fin_cashflow_entries`           |
| DB columns          | `snake_case`   | `created_at`, `member_id`        |
| API endpoints       | `kebab-case`   | `/finance/cashflow`              |
| API request fields  | `snake_case`   | `cost_price`, `buyer_name`       |
| API response fields | match contract | `cashflow_id`, `remaining_stock` |
| TS variables        | `camelCase`    | `memberId`                       |
| TS types/interfaces | `PascalCase`   | `TokenPayload`                   |
| Files               | `kebab-case`   | `cashflow.ts`, `auth.ts`         |

---

## API Response Format

### Success

```json
{
  "success": true,
  "data": {}
}
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

- Login uses `nim` + password.
- Passwords are hashed and stored in `users.password_hash`.
- All protected routes require `Authorization: Bearer <token>`.
- `must_change_password` is enforced in auth middleware.
- JWT payload must contain `sub`, `memberId`, `nim`, `roles`, and `mustChangePassword`.

---

## RBAC Conventions

- MVP roles are `finance` and `member`.
- Route protection currently uses `requireRole(...)`.
- Only `finance` can mutate finance resources.
- Members can access read-only endpoints intended for dashboard transparency.
- Do not mix role-based and permission-string middleware in parallel unless the app is explicitly migrated to a permission model.

---

## Drizzle Conventions

- Every table has a UUID primary key.
- Every table has `created_at` and `updated_at`.
- Tables supporting deletion use soft delete fields such as `deleted_at`, `deleted_by`, and `delete_reason`.
- Finance queries should exclude soft-deleted rows by default.
- Money is stored as `numeric/decimal`, never float.
- Derived values such as merch sale totals should be computed from canonical stored fields when the schema does not persist them.
