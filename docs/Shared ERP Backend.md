# VeteranTech Database Schema — Shared ERP Backend

> **Status:** Draft source of truth.
> **Source of Truth:** Draft database schema, seed lists, indexes, auth tables, audit tables, and finance data model.

Related: [[index]], [[VeteranTech Organization Database Notes]], [[RBAC Permission Matrix]], [[Tech Stack Decisions]]

> **Context:** Database design for VeteranTech's modular ERP system. Designed as a shared backend that Finance Dashboard consumes first, with future modules ([[Peops]], [[Marcomms]], etc.) using the same database.
> **Database:** PostgreSQL
> **ORM:** [[Drizzle]]
> **IDs:** UUIDs
> **Auth:** [[Internal Auth]] using NIM + password
> **Decision Date:** April 2026
> **Status:** Draft

---

## 1. Design Principles

1. **Shared core, modular extensions.** Members, org structure, and auth are shared. Finance tables, [[Peops]] tables, [[Marcomms]] tables are separate modules that reference the shared core.
2. **staff is temporal.** Members are permanent. Their roles/divisions change yearly via a `staff_members` junction table tied to a `staff_periods` table.
3. **Financial data is continuous.** Cashflow, payments, and programs persist across staff periods. Only role assignments reset.
4. **Programs are flexible.** Regular events, flagship programs (Lombakan), and interns are all `programs` with different types — not separate systems.
5. **Two-dimensional categorization.** Every transaction is tagged with a category (what type) and optionally a program (which activity). See [[Two-Dimensional Categorization]] and [[Categorization Architecture|Categorization Architecture]].

---

## 2. Entity Relationship Overview

┌─────────────────────────────────────────────────────────────┐
│ SHARED CORE │
│ < member_roles >── roles |
│ |
│ members ──── staff_members ──── staff_periods │
│ │ | │
│ │ divisions ──── units |
│ │ | │
│ │ programs │
│ │ │
│ users (auth) │
└──────────────┬──────────────────────────────────────────────┘
│
┌───────┴────────┐
│ │
┌──────▼──────┐ ┌──────▼──────┐
│ FINANCE │ │ FUTURE │
│ MODULE │ │ MODULES │
│ │ │ │
│ fin_categories │ │ (Peops, │
│ fin_cashflow_entries│ │ Marcomms, │
│ fin_member_dues │ │ Academic) │
│ fin_dues_config │ │ │
│ fin_reimbursements │ │ │
│ fin_merch_products │ │ │
│ fin_merch_sales │ │ │
└─────────────┘ └─────────────┘

---

## 3. [[Shared Core Tables]]

### 3.1 `members`

The single source of truth for every person in VeteranTech — regular members, staff, alumni, interns. Permanent record that persists across staff periods.

members
├── id UUID PK, default gen_random_uuid()
├── name VARCHAR NOT NULL
├── nim VARCHAR UNIQUE, NOT NULL
├── cohort_year INTEGER NOT NULL -- e.g. 2023, 2024
├── member_type ENUM ('member', 'staff', 'alumni')
├── status ENUM ('active', 'inactive') -- currently participating or not
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

**Notes:**

- `member_type` reflects their CURRENT status. When staff resets, outgoing staff get flipped back to `member` (or `alumni` if graduated). Incoming staff get flipped to `staff`.- No email/phone stored here by default. Auth uses [[Internal Auth]] with NIM + password. If needed later, add optional `email` and `phone` columns.
- NIM is the universal human-readable identifier for admin lookups and display.

### 3.2 `users` (Auth)

Separate from members because auth is a system concern, not a domain concern. Linked 1:1 to a member. MVP auth uses NIM as username and an internal password.

users
├── id UUID PK, default gen_random_uuid()
├── member_id UUID FK → members, UNIQUE, NOT NULL
├── username VARCHAR UNIQUE, NOT NULL -- use member NIM
├── password_hash VARCHAR NOT NULL
├── must_change_password BOOLEAN DEFAULT true
├── is_active BOOLEAN DEFAULT true
├── last_login TIMESTAMP nullable
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

**Notes:**

- Not every member needs a `users` row immediately. Create user rows for accounts that need dashboard access.
- Initial usernames can be seeded from NIM.
- Initial passwords may be provisioned during setup, but implementation should store only `password_hash`.
- `must_change_password` should force users to replace seeded/default passwords after first login when feasible.

### 3.3 `units`

The three organizational units: R&D, Growth, Operations.

units
├── id UUID PK
├── name VARCHAR NOT NULL -- "R&D", "Growth", "Operations"
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

### 3.4 `divisions`

Divisions within units. [[Lombakan]] is a standalone division/program label with `unit_id = NULL` for the MVP.

divisions
├── id UUID PK
├── unit_id UUID FK → units, nullable -- NULL for Lombakan
├── name VARCHAR NOT NULL
├── is_active BOOLEAN DEFAULT true
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

**Seed data:**
| Division | Unit |
|---|---|
| Protech | R&D |
| Academic | R&D |
| Business Development | Growth |
| MarComms | Growth |
| People Operations | Growth |
| Finance | Operations |
| Administration | Operations |
| Lombakan | _(none)_ |

### 3.5 `staff_periods`

Tracks each staff cycle. The transition date is flexible (usually Jan-Feb) so we use explicit start/end dates.

staff_periods
├── id UUID PK
├── name VARCHAR NOT NULL -- e.g. "Staff 2025/2026"
├── start_date DATE NOT NULL
├── end_date DATE nullable -- NULL if current/ongoing
├── is_active BOOLEAN DEFAULT true -- only one active at a time
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

### 3.6 `staff_members`

Junction table: who holds what position in which division during which staff. This is what "resets" every year — old rows stay (historical), new rows are created for the new period.

staff_members
├── id UUID PK
├── staff_id UUID FK → staff_periods, NOT NULL
├── member_id UUID FK → members, NOT NULL
├── division_id UUID FK → divisions, NOT NULL
├── position ENUM ('president', 'vice_president',
│ 'division_head', 'deputy_division_head',
│ 'staff')
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

UNIQUE(staff_id, member_id) -- one role per person per period

**Notes:**

- President's `division_id` can point to a special "Presidium" division, or be nullable. Up to implementation preference.
- Vice Presidents have `position = 'vice_president'` and their `division_id` is irrelevant (they're unit heads), OR we can add a `unit_id` FK here. Simpler to just pick a division and note the VP role.
- Historical data is preserved — querying past periods is just filtering by `staff_id`.

### 3. 7 `programs` (Work Programs / Events)

Dynamic list of events, flagship programs, and external projects.

programs
├── id UUID PK
├── name VARCHAR NOT NULL -- "Tech for Society", "Hackathon 2026"
├── type ENUM ('event', 'recurring', 'external', 'flagship')
│ -- flagship = Lombakan-level programs
├── division_id UUID FK → divisions, nullable -- which division owns this
├── budget DECIMAL nullable -- allocated budget
├── status ENUM ('planning', 'active', 'completed', 'cancelled')
├── description TEXT nullable
├── start_date DATE nullable
├── end_date DATE nullable
├── created_by UUID FK → members
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

### 3.8 `roles` (Dashboard Permissions)

Separate from jabatan. This controls what you can do in the dashboard, not your org title. MVP permissions follow [[RBAC Permission Matrix]].

roles
├── id UUID PK
├── name VARCHAR UNIQUE, NOT NULL
│ -- MVP seeds: 'finance', 'member'├── permissions JSONB NOT NULL -- e.g. {"finance": ["read", "write"], "members": ["read"]}
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

member_roles
├── id UUID PK
├── member_id UUID FK → members, NOT NULL
├── role_id UUID FK → roles, NOT NULL
├── assigned_by UUID FK → members, nullable
├── created_at TIMESTAMP DEFAULT now()

UNIQUE(member_id, role_id)

**Notes:**

- The MVP only needs [[Finance]] and [[Member]].
- Finance 1 and Finance 2 are operational scopes, not separate dashboard roles.
- Permissions are stored as JSONB for flexibility — no need to build a full enterprise RBAC permission table for an ormawa.

---

## 4. [[Finance Module Tables]]

### 4.1 `fin_categories` (Simplified Chart of Accounts)

Fixed list of income/expense types. See [[Two-Dimensional Categorization]] and [[Categorization Architecture|Categorization Architecture]].

fin_categories
├── id UUID PK
├── name VARCHAR NOT NULL -- "Consumables", "Transport", "MemberDues"
├── type ENUM ('income', 'expense')
├── parent_id UUID FK → fin_categories, nullable -- for subcategories
├── is_active BOOLEAN DEFAULT true
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

### 4.3 `fin_cashflow_entries` (Core Ledger)

fin_cashflow_entries
├── id UUID PK
├── type ENUM ('income', 'expense')
├── entry_kind ENUM ('normal', 'opening_balance', 'adjustment')
├── category_id UUID FK → fin_categories, NOT NULL
├── program_id UUID FK → programs, nullable
├── description VARCHAR NOT NULL
├── amount DECIMAL NOT NULL
├── payment_method ENUM ('bni', 'gopay', 'cash')
├── receipt_url VARCHAR nullable
├── source_id UUID nullable -- FK to originating record, resolve via category_id
├── recorded_by UUID FK → members, NOT NULL
├── updated_by UUID FK → members, nullable
├── deleted_by UUID FK → members, nullable
├── date DATE NOT NULL
├── notes TEXT nullable
├── created_at TIMESTAMP DEFAULT now()
├── updated_at TIMESTAMP DEFAULT now()
├── deleted_at TIMESTAMP nullable
└── delete_reason TEXT nullable

**Notes:**

- `opening_balance` seeds the system's starting balance.
- `adjustment` corrects discrepancies found during [[Reconciliation]].
- Use [[Soft Delete]] instead of hard-deleting entries.
- Important changes write to [[Audit Trail]].

### 4.4 `fin_account_balances` (Cash Position)

> **Dropped as a stored table.** Balance is derived on-demand via query to avoid sync issues with soft deletes, voids, and adjustments:

```sql
SELECT payment_method,
       SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS balance
FROM fin_cashflow_entries
WHERE deleted_at IS NULL
GROUP BY payment_method
```

If query performance becomes an issue at scale, promote this to a **materialized view** — not a manually-maintained table.

### 4.5 `fin_dues_config` (Per-Member Payment Rules)

fin_dues_config
├── id UUID PK
├── member_id UUID FK → members, NOT NULL
├── staff_period_id UUID FK → staff_periods, NOT NULL
├── monthly_amount DECIMAL NOT NULL, DEFAULT 15000
├── leniency_type ENUM ('none', 'reduced_fixed', 'reduced_temporary')
│ -- none = 15k standard
│ -- reduced_fixed = custom amount for full period
│ -- reduced_temporary = custom amount for specific months
├── leniency_start DATE nullable
├── leniency_end DATE nullable
├── notes TEXT nullable -- reason for leniency
├── configured_by UUID FK → members
├── updated_by UUID FK → members, nullable
├── created_at TIMESTAMP DEFAULT now()
└── updated_at TIMESTAMP DEFAULT now()

UNIQUE(member_id, staff_period_id)

### 4.6 `fin_member_dues`

fin_member_dues
├── id UUID PK
├── member_id UUID FK → members, NOT NULL
├── month INTEGER NOT NULL -- 1-12
├── year INTEGER NOT NULL -- 2026
├── amount DECIMAL NOT NULL -- actual amount paid (could be 0 for exempt)
├── status ENUM ('unpaid', 'pending', 'verified', 'exempt')
├── exempt_reason VARCHAR nullable -- "Top point April 2026"
├── receipt_url VARCHAR nullable
├── payment_method ENUM ('bni', 'gopay', 'cash') nullable
├── paid_at TIMESTAMP nullable
├── verified_by UUID FK → members, nullable
├── verified_at TIMESTAMP nullable
├── cashflow_id UUID FK → fin_cashflow_entries, nullable -- link to ledger
├── created_by UUID FK → members, nullable
├── updated_by UUID FK → members, nullable
├── deleted_by UUID FK → members, nullable
├── created_at TIMESTAMP DEFAULT now()
├── updated_at TIMESTAMP DEFAULT now()
├── deleted_at TIMESTAMP nullable
└── delete_reason TEXT nullable

UNIQUE(member_id, month, year)

### 4.7 `fin_reimbursement_requests`

fin_reimbursement_requests
├── id UUID PK
├── member_id UUID FK → members, NOT NULL
├── program_id UUID FK → programs, nullable
├── activity_title VARCHAR NOT NULL
├── category_id UUID FK → fin_categories, NOT NULL -- Consumables, Transport, etc.
├── amount DECIMAL NOT NULL
├── purchase_receipt_url VARCHAR NOT NULL
├── payment_destination ENUM ('bni', 'gopay')
├── account_info VARCHAR nullable -- account number or gopay phone
├── status ENUM ('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled')
├── rejection_reason TEXT nullable
├── approved_by UUID FK → members, nullable
├── approved_at TIMESTAMP nullable
├── transfer_receipt_url VARCHAR nullable -- uploaded after payment
├── paid_at TIMESTAMP nullable
├── cashflow_id UUID FK → fin_cashflow_entries, nullable
├── created_by UUID FK → members, NOT NULL
├── updated_by UUID FK → members, nullable
├── deleted_by UUID FK → members, nullable
├── created_at TIMESTAMP DEFAULT now()
├── updated_at TIMESTAMP DEFAULT now()
├── deleted_at TIMESTAMP nullable
└── delete_reason TEXT nullable

**Notes:**

- Valid status transitions follow [[Reimbursement State Machine]].
- Every transition writes a row to `fin_reimbursement_events`.

### 4.9 `fin_merch_products`

fin_merch_products
├── id UUID PK
├── name VARCHAR NOT NULL
├── merch_line VARCHAR nullable -- specific merch line name
├── design_url VARCHAR nullable
├── cost_price DECIMAL NOT NULL
├── selling_price DECIMAL NOT NULL
├── stock INTEGER NOT NULL, DEFAULT 0
├── is_active BOOLEAN DEFAULT true
├── created_by UUID FK → members, nullable
├── updated_by UUID FK → members, nullable
├── deleted_by UUID FK → members, nullable
├── created_at TIMESTAMP DEFAULT now()
├── updated_at TIMESTAMP DEFAULT now()
├── deleted_at TIMESTAMP nullable
└── delete_reason TEXT nullable

### 4.10 `fin_merch_sales`

fin_merch_sales
├── id UUID PK
├── product_id UUID FK → fin_merch_products, NOT NULL
├── buyer_name VARCHAR nullable -- could be non-member
├── qty INTEGER NOT NULL
├── unit_price DECIMAL NOT NULL -- selling price at time of sale
├── payment_method ENUM ('bni', 'gopay', 'cash')
├── receipt_url VARCHAR nullable
├── cashflow_id UUID FK → fin_cashflow_entries, nullable
├── recorded_by UUID FK → members
├── updated_by UUID FK → members, nullable
├── deleted_by UUID FK → members, nullable
├── created_at TIMESTAMP DEFAULT now()
├── updated_at TIMESTAMP DEFAULT now()
├── deleted_at TIMESTAMP nullable
└── delete_reason TEXT nullable

### 4.11 `fin_project_transactions`

> **Dropped.** Redundant with `fin_cashflow_entries` — external project income/expenses are recorded there with `category_id` (Vexpro/Busdev) and `program_id` for per-project filtering and P&L. No separate table needed.

### 4.12 `fin_reimbursement_events`

> **Dropped.** Status transitions are captured by `audit_events` (append-only, with `before`/`after` JSONB). To query reimbursement history: filter `audit_events` where `entity_type = 'fin_reimbursement_requests'` and `entity_id = <id>`.

### 4.13 `audit_events` (Immutable Audit Trail)

audit_events
├── id UUID PK
├── actor_id UUID FK → members, nullable
├── entity_type VARCHAR NOT NULL -- 'fin_cashflow_entries', 'fin_member_dues', etc.
├── entity_id UUID NOT NULL
├── action VARCHAR NOT NULL -- 'created', 'updated', 'verified', 'voided', etc.
├── before JSONB nullable
├── after JSONB nullable
├── reason TEXT nullable
├── created_at TIMESTAMP DEFAULT now()

**Notes:**

- `audit_events` is append-only.
- Do not soft-delete audit rows.
- Use this for [[Audit Trail]], [[Soft Delete]], [[Reconciliation]], auth/role changes, and reimbursement transitions.

---

## 5. File Storage

Multiple tables reference `receipt_url`, `design_url`, etc. For MVP:

- Store files in an **object storage** bucket on your VPS (or a free-tier S3-compatible service like Cloudflare R2).
- The `*_url` columns store the public/signed URL to the file.
- If budget is zero, store files locally on VPS filesystem and serve them via your API. Less ideal but works for MVP scale.

---

## 6. Indexes (Performance)

Key indexes to create beyond PKs and FKs:

-- Member lookups
CREATE INDEX idx_members_nim ON members(nim);
CREATE INDEX idx_members_cohort_year ON members(cohort_year);

-- Staff period queries
CREATE INDEX idx_staff_members_period ON staff_members(staff_id);
CREATE INDEX idx_staff_members_member ON staff_members(member_id);

-- Cashflow queries (the most queried table)
CREATE INDEX idx_cashflow_date ON fin_cashflow_entries(date);
CREATE INDEX idx_cashflow_type ON fin_cashflow_entries(type);
CREATE INDEX idx_cashflow_entry_kind ON fin_cashflow_entries(entry_kind);
CREATE INDEX idx_cashflow_category ON fin_cashflow_entries(category_id);
CREATE INDEX idx_cashflow_program ON fin_cashflow_entries(program_id);
CREATE INDEX idx_cashflow_date_type ON fin_cashflow_entries(date, type);

-- Member dues lookups
CREATE INDEX idx_member_dues_member_period ON fin_member_dues(member_id, year, month);
CREATE INDEX idx_member_dues_status ON fin_member_dues(status);

-- Reimbursement queue
CREATE INDEX idx_reimburse_status ON fin_reimbursement_requests(status);
CREATE INDEX idx_reimburse_member ON fin_reimbursement_requests(member_id);

-- Audit/event lookups
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);

---

## 7. Seed Data

### Units

| id  | name       |
| --- | ---------- |
| ... | R&D        |
| ... | Growth     |
| ... | Operations |

### Divisions

| name                 | unit       |
| -------------------- | ---------- |
| Protech              | R&D        |
| Academic             | R&D        |
| Business Development | Growth     |
| MarComms             | Growth     |
| People Operations    | Growth     |
| Finance              | Operations |
| Administration       | Operations |
| Lombakan             | _(none)_   |

### Categories (Income)

MemberDues, Merchandise, Vexpro, Busdev, StudyClub, Grant, BudgetAllocation, OpeningBalance

### Categories (Expense)

Consumables, Transport, Logistics, Supplies, DomainAndHosting, DesignAndPrint, Adjustment, Miscellaneous

### Roles

| name    | permissions                                                                              |
| ------- | ---------------------------------------------------------------------------------------- |
| finance | Validate member dues, approve reimbursement, record cashflow, manage categories/programs |
| member  | Pay member dues, request reimbursement, view transparency dashboard                      |

### Auth Seed Data

For MVP setup, seed internal accounts using NIM as `username`.

| field                        | source                             |
| ---------------------------- | ---------------------------------- |
| `users.username`             | member NIM                         |
| `users.password_hash`        | hashed seeded/default password     |
| `users.must_change_password` | `true` for seeded/default accounts |

Do not seed or store plaintext passwords in the database.

---

## 8. Data Flow Examples

### Member Pays Member Dues

1. [[Member]] submits payment form (month, receipt, payment method).
2. System creates `fin_member_dues` row with `status: 'pending'`.
3. [[Finance]] verifies → updates to `status: 'verified'`.
4. System auto-creates `fin_cashflow_entries` row (type: income, category: MemberDues).
5. `audit_events` row written for the verification action.

### Staff Member Requests Reimbursement

1. Staff member submits [[Reimbursement]] form (activity, category, amount, receipt, payment destination).
2. System creates `fin_reimbursement_requests` row with `status: 'pending'`.
3. [[Finance]] reviews → `status: 'approved'` or `'rejected'`. `audit_events` row written.
4. If approved, finance transfers money outside the app (manual).
5. Finance uploads transfer receipt → `status: 'paid'`. `audit_events` row written.
6. System auto-creates `fin_cashflow_entries` row (type: expense, category from request).

### Merch Sale

1. Finance records sale (product, qty, payment method).
2. System creates `fin_merch_sales` row.
3. System decrements `fin_merch_products.stock`.
4. System auto-creates `fin_cashflow_entries` row (type: income, category: Merchandise).

---

## 9. Relationship to Other Docs

- **[[PRD Draft]]** — Full feature requirements and MVP scope.
- **[[Accounting Architecture Decisions]]** — Why single-entry, not double-entry.
- **[[Categorization Architecture]]** — Two-dimensional categorization (kategori + program).
- **[[index]]** — Project hub.

---

_This schema is the current draft source of truth. Column types and constraints may still be adjusted during [[Drizzle]] schema creation._
