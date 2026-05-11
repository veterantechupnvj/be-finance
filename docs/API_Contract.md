# VeteranTech API Contract

> **Status:** Draft
> **Base URL:** `https://api.veterantech.id/v1` (VPS self-hosted)
> **Framework:** Hono
> **Auth:** JWT Bearer token
> **Content-Type:** `application/json`

Related: [[Shared ERP Backend]], [[RBAC Permission Matrix]], [[PRD Draft]]

---

## Conventions

### Auth Header

Every protected route requires:

```
Authorization: Bearer <token>
```

### Role Guards

- `[public]` — no auth required
- `[member]` — any authenticated user
- `[finance]` — finance role only

### Standard Response Shape

**Success:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Paginated:**

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20,
    "total_pages": 5
  }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You do not have permission to perform this action."
  }
}
```

### Standard Error Codes

| Code               | HTTP | When                              |
| ------------------ | ---- | --------------------------------- |
| `UNAUTHORIZED`     | 401  | Missing or invalid token          |
| `FORBIDDEN`        | 403  | Valid token but insufficient role |
| `NOT_FOUND`        | 404  | Resource does not exist           |
| `VALIDATION_ERROR` | 422  | Invalid request body/params       |
| `CONFLICT`         | 409  | Duplicate unique constraint       |
| `INTERNAL_ERROR`   | 500  | Unexpected server error           |

### Soft Delete

Deleted records are excluded from all list/get responses by default.
Finance role can request deleted records with `?include_deleted=true`.

---

## 1. Auth

### `POST /auth/login` `[public]`

Login with NIM + password.

**Request:**

```json
{
  "nim": "2310512001",
  "password": "secret"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "must_change_password": true,
    "member": {
      "id": "uuid",
      "name": "Budi Santoso",
      "nim": "2310512001",
      "role": "finance"
    }
  }
}
```

---

### `POST /auth/change-password` `[member]`

Required on first login if `must_change_password = true`.

**Request:**

```json
{
  "current_password": "old",
  "new_password": "new"
}
```

**Response:**

```json
{ "success": true, "data": { "message": "Password updated." } }
```

---

### `POST /auth/logout` `[member]`

Invalidates current token (server-side blocklist or short-lived JWT — implementation decision).

**Response:**

```json
{ "success": true, "data": { "message": "Logged out." } }
```

---

### `GET /auth/me` `[member]`

Returns current user's profile + role.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Budi Santoso",
    "nim": "2310512001",
    "cohort_year": 2023,
    "member_type": "staff",
    "role": "finance"
  }
}
```

---

## 2. Members

### `GET /members` `[finance]`

List all members. Supports filtering and pagination.

**Query params:**
| param | type | description |
|---|---|---|
| `page` | int | default 1 |
| `per_page` | int | default 20, max 100 |
| `search` | string | search by name or NIM |
| `status` | string | `active` \| `inactive` |
| `member_type` | string | `member` \| `staff` \| `alumni` |
| `cohort_year` | int | filter by cohort year |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Budi Santoso",
      "nim": "2310512001",
      "cohort_year": 2023,
      "member_type": "staff",
      "status": "active"
    }
  ],
  "meta": { "total": 80, "page": 1, "per_page": 20, "total_pages": 4 }
}
```

---

### `GET /members/:id` `[finance]`

Get single member detail.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Budi Santoso",
    "nim": "2310512001",
    "cohort_year": 2023,
    "member_type": "staff",
    "status": "active",
    "role": "member",
    "division": "Finance",
    "position": "staff"
  }
}
```

---

## 3. Finance — Categories

### `GET /finance/categories` `[member]`

List all active categories.

**Query params:**
| param | type | description |
|---|---|---|
| `type` | string | `income` \| `expense` |

**Response:**

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "MemberDues", "type": "income", "parent_id": null },
    { "id": "uuid", "name": "Consumables", "type": "expense", "parent_id": null }
  ]
}
```

---

### `POST /finance/categories` `[finance]`

**Request:**

```json
{
  "name": "Equipment",
  "type": "expense",
  "parent_id": null
}
```

**Response:** `201` with created category object.

---

### `PATCH /finance/categories/:id` `[finance]`

Update name or active status.

**Request:**

```json
{
  "name": "Equipment & Supplies",
  "is_active": true
}
```

---

## 4. Finance — Programs

### `GET /finance/programs` `[member]`

List programs.

**Query params:**
| param | type | description |
|---|---|---|
| `status` | string | `planning` \| `active` \| `completed` \| `cancelled` |
| `type` | string | `event` \| `recurring` \| `external` \| `flagship` |
| `division_id` | uuid | filter by division |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Tech for Society",
      "type": "flagship",
      "status": "active",
      "budget": 5000000,
      "division": "Protech",
      "start_date": "2026-03-01",
      "end_date": "2026-04-30"
    }
  ]
}
```

---

### `POST /finance/programs` `[finance]`

**Request:**

```json
{
  "name": "Hackathon 2026",
  "type": "event",
  "division_id": "uuid",
  "budget": 3000000,
  "status": "planning",
  "description": "Annual hackathon",
  "start_date": "2026-05-01",
  "end_date": "2026-05-03"
}
```

---

### `PATCH /finance/programs/:id` `[finance]`

Update program details or status.

---

## 5. Finance — Cashflow

### `GET /finance/cashflow` `[member]`

List cashflow entries. Used for transparency dashboard and finance ledger.

**Query params:**
| param | type | description |
|---|---|---|
| `page` | int | default 1 |
| `per_page` | int | default 20 |
| `type` | string | `income` \| `expense` |
| `entry_kind` | string | `normal` \| `opening_balance` \| `adjustment` |
| `category_id` | uuid | filter by category |
| `program_id` | uuid | filter by program |
| `payment_method` | string | `bni` \| `gopay` \| `cash` |
| `date_from` | date | `YYYY-MM-DD` |
| `date_to` | date | `YYYY-MM-DD` |
| `include_deleted` | bool | `[finance]` only, default false |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "income",
      "entry_kind": "normal",
      "category": { "id": "uuid", "name": "MemberDues" },
      "program": null,
      "description": "Member dues March 2026 - Budi",
      "amount": 15000,
      "payment_method": "bni",
      "receipt_url": "https://...",
      "date": "2026-03-05",
      "recorded_by": { "id": "uuid", "name": "Siti" },
      "notes": null,
      "created_at": "2026-03-05T10:00:00Z"
    }
  ],
  "meta": { "total": 200, "page": 1, "per_page": 20, "total_pages": 10 }
}
```

---

### `GET /finance/cashflow/summary` `[member]`

Aggregated summary for dashboard charts.

**Query params:**
| param | type | description |
|---|---|---|
| `period` | string | `monthly` \| `weekly` |
| `year` | int | e.g. `2026` |
| `month` | int | 1-12, optional (for weekly breakdown) |

**Response:**

```json
{
  "success": true,
  "data": {
    "total_income": 12500000,
    "total_expense": 7300000,
    "net": 5200000,
    "balance_by_method": {
      "bni": 3000000,
      "gopay": 1500000,
      "cash": 700000
    },
    "income_by_category": [
      { "category": "MemberDues", "amount": 6000000 },
      { "category": "Merchandise", "amount": 2500000 }
    ],
    "expense_by_category": [
      { "category": "Consumables", "amount": 3000000 },
      { "category": "Transport", "amount": 1200000 }
    ],
    "timeline": [
      { "period": "2026-01", "income": 2000000, "expense": 800000 },
      { "period": "2026-02", "income": 1800000, "expense": 1200000 }
    ]
  }
}
```

---

### `POST /finance/cashflow` `[finance]`

Manually record a cashflow entry.

**Request:**

```json
{
  "type": "expense",
  "entry_kind": "normal",
  "category_id": "uuid",
  "program_id": "uuid",
  "description": "Consumables for Tech for Society",
  "amount": 350000,
  "payment_method": "cash",
  "receipt_url": "https://...",
  "date": "2026-04-10",
  "notes": "Snacks for 50 people"
}
```

**Response:** `201` with created entry object.

---

### `PATCH /finance/cashflow/:id` `[finance]`

Edit a cashflow entry. Writes to `audit_events`.

---

### `DELETE /finance/cashflow/:id` `[finance]`

Soft delete. Requires reason.

**Request:**

```json
{ "reason": "Duplicate entry, recorded twice." }
```

---

## 6. Finance — Member Dues

### `GET /finance/dues` `[finance]`

List all dues records across all members.

**Query params:**
| param | type | description |
|---|---|---|
| `month` | int | 1-12 |
| `year` | int | e.g. `2026` |
| `status` | string | `unpaid` \| `pending` \| `verified` \| `exempt` |
| `member_id` | uuid | filter by member |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "member": { "id": "uuid", "name": "Budi", "nim": "2310512001" },
      "month": 3,
      "year": 2026,
      "amount": 15000,
      "status": "verified",
      "payment_method": "bni",
      "receipt_url": "https://...",
      "paid_at": "2026-03-05T10:00:00Z",
      "verified_by": { "id": "uuid", "name": "Siti" },
      "verified_at": "2026-03-06T09:00:00Z"
    }
  ]
}
```

---

### `GET /finance/dues/me` `[member]`

Current user's own dues status across all months.

**Query params:**
| param | type | description |
|---|---|---|
| `year` | int | default current year |

**Response:**

```json
{
  "success": true,
  "data": [
    { "month": 1, "year": 2026, "amount": 15000, "status": "verified" },
    { "month": 2, "year": 2026, "amount": 15000, "status": "pending" },
    {
      "month": 3,
      "year": 2026,
      "amount": 0,
      "status": "exempt",
      "exempt_reason": "Top point February 2026"
    }
  ]
}
```

---

### `POST /finance/dues/pay` `[member]`

Submit dues payment proof.

**Request:** `multipart/form-data`
| field | type | required |
|---|---|---|
| `month` | int | yes |
| `year` | int | yes |
| `payment_method` | string | yes |
| `receipt` | file | yes |

**Response:** `201`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "month": 3,
    "year": 2026,
    "status": "pending",
    "message": "Payment submitted. Awaiting finance verification."
  }
}
```

---

### `PATCH /finance/dues/:id/verify` `[finance]`

Verify a pending dues payment. Auto-creates cashflow entry.

**Request:**

```json
{ "verified": true }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "verified",
    "cashflow_id": "uuid"
  }
}
```

---

### `PATCH /finance/dues/:id/exempt` `[finance]`

Mark a member as exempt for a given month.

**Request:**

```json
{
  "month": 3,
  "year": 2026,
  "member_id": "uuid",
  "exempt_reason": "Top point February 2026"
}
```

---

### `GET /finance/dues/config/:member_id` `[finance]`

Get leniency config for a member.

---

### `POST /finance/dues/config` `[finance]`

Set or update leniency config for a member.

**Request:**

```json
{
  "member_id": "uuid",
  "staff_period_id": "uuid",
  "monthly_amount": 5000,
  "leniency_type": "reduced_fixed",
  "leniency_start": null,
  "leniency_end": null,
  "notes": "Agreed due to financial hardship"
}
```

---

## 7. Finance — Reimbursements

### `GET /finance/reimbursements` `[finance]`

List all reimbursement requests (queue view).

**Query params:**
| param | type | description |
|---|---|---|
| `status` | string | `draft` \| `submitted` \| `approved` \| `rejected` \| `paid` \| `cancelled` |
| `member_id` | uuid | filter by requester |
| `program_id` | uuid | filter by program |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "member": { "id": "uuid", "name": "Budi", "nim": "2310512001" },
      "program": { "id": "uuid", "name": "Tech for Society" },
      "activity_title": "Grocery run for event",
      "category": { "id": "uuid", "name": "Consumables" },
      "amount": 250000,
      "status": "submitted",
      "payment_destination": "gopay",
      "account_info": "08123456789",
      "purchase_receipt_url": "https://...",
      "transfer_receipt_url": null,
      "created_at": "2026-04-10T08:00:00Z"
    }
  ]
}
```

---

### `GET /finance/reimbursements/me` `[member]`

Current user's own reimbursement requests.

---

### `GET /finance/reimbursements/:id` `[member]`

Single reimbursement detail + audit history.

**Response includes:**

```json
{
  "success": true,
  "data": {
    "...reimbursement fields...",
    "audit_trail": [
      {
        "action": "submitted",
        "actor": { "name": "Budi" },
        "at": "2026-04-10T08:00:00Z",
        "notes": null
      },
      {
        "action": "approved",
        "actor": { "name": "Siti" },
        "at": "2026-04-11T10:00:00Z",
        "notes": null
      }
    ]
  }
}
```

---

### `POST /finance/reimbursements` `[member]`

Submit a reimbursement request.

**Request:** `multipart/form-data`
| field | type | required |
|---|---|---|
| `activity_title` | string | yes |
| `category_id` | uuid | yes |
| `program_id` | uuid | no |
| `amount` | number | yes |
| `payment_destination` | string | yes (`bni` \| `gopay`) |
| `account_info` | string | yes |
| `purchase_receipt` | file | yes |

**Response:** `201` with created reimbursement object, `status: 'submitted'`.

---

### `PATCH /finance/reimbursements/:id/approve` `[finance]`

Approve a submitted reimbursement.

**Response:** `200` with updated status.

---

### `PATCH /finance/reimbursements/:id/reject` `[finance]`

Reject a reimbursement.

**Request:**

```json
{ "reason": "Receipt is illegible. Please resubmit." }
```

---

### `PATCH /finance/reimbursements/:id/mark-paid` `[finance]`

Upload transfer receipt and mark as paid. Auto-creates cashflow entry.

**Request:** `multipart/form-data`
| field | type | required |
|---|---|---|
| `transfer_receipt` | file | yes |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "paid",
    "cashflow_id": "uuid"
  }
}
```

---

### `PATCH /finance/reimbursements/:id/cancel` `[member]`

Cancel own draft/submitted reimbursement.

---

## 8. Finance — Merchandise

### `GET /finance/merch/products` `[member]`

List active products.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "T-Shirt VT 2026",
      "merch_line": "VT 2026",
      "design_url": "https://...",
      "cost_price": 45000,
      "selling_price": 75000,
      "stock": 23,
      "is_active": true
    }
  ]
}
```

---

### `POST /finance/merch/products` `[finance]`

**Request:**

```json
{
  "name": "T-Shirt VT 2026",
  "merch_line": "VT 2026",
  "design_url": "https://...",
  "cost_price": 45000,
  "selling_price": 75000,
  "stock": 50
}
```

---

### `PATCH /finance/merch/products/:id` `[finance]`

Update product details or restock.

---

### `DELETE /finance/merch/products/:id` `[finance]`

Soft delete (deactivate) a product.

---

### `GET /finance/merch/sales` `[finance]`

List all sales records.

**Query params:**
| param | type | description |
|---|---|---|
| `product_id` | uuid | filter by product |
| `date_from` | date | |
| `date_to` | date | |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "product": { "id": "uuid", "name": "T-Shirt VT 2026" },
      "buyer_name": "Andi",
      "qty": 2,
      "unit_price": 75000,
      "payment_method": "gopay",
      "receipt_url": "https://...",
      "recorded_by": { "name": "Siti" },
      "created_at": "2026-04-15T14:00:00Z"
    }
  ]
}
```

---

### `POST /finance/merch/sales` `[finance]`

Record a sale. Auto-decrements stock + auto-creates cashflow entry.

**Request:**

```json
{
  "product_id": "uuid",
  "buyer_name": "Andi",
  "qty": 2,
  "payment_method": "gopay",
  "receipt_url": "https://..."
}
```

**Response:** `201`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "cashflow_id": "uuid",
    "remaining_stock": 21
  }
}
```

---

## 9. File Upload

### `POST /upload` `[member]`

Upload a file to object storage. Returns a URL to store in the relevant table.

**Request:** `multipart/form-data`
| field | type | description |
|---|---|---|
| `file` | file | image or PDF, max 5MB |
| `context` | string | `dues_receipt` \| `purchase_receipt` \| `transfer_receipt` \| `merch_design` |

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://storage.veterantech.id/uploads/dues_receipt/2026/abc123.jpg"
  }
}
```

---

## 10. Reference Data

### `GET /ref/divisions` `[member]`

List all divisions (for dropdowns).

### `GET /ref/staff-periods` `[member]`

List all staff periods.

### `GET /ref/staff-periods/active` `[member]`

Get the current active staff period.

---

## Appendix — State Machines

### Member Dues Status

```
unpaid → pending (member submits proof)
pending → verified (finance verifies)
pending → unpaid (finance rejects proof)
any → exempt (finance marks exempt)
```

### Reimbursement Status

```
submitted → approved (finance approves)
submitted → rejected (finance rejects)
approved → paid (finance marks paid + uploads transfer receipt)
submitted → cancelled (member cancels)
rejected → submitted (member resubmits — creates new record)
```

---

_This contract is a living draft. Endpoints and shapes may evolve as implementation progresses. Frontend should always validate against this doc before building a new page._
