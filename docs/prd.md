> **Status:** Draft source of truth.
> **Source of Truth:** Draft product requirements, feature scope, MVP phases, and user-facing workflows.

> **Organisasi:** VeteranTech — Organisasi Mahasiswa UPN Veteran Jakarta
> **Date:** May 2026

---

## 1. Background & Context

VeteranTech is a nonprofit student organization (Organisasi Mahasiswa) at UPN Veteran Jakarta. Previously, the organization attempted to build a massive, centralized "portal" that covered everything — it failed due to bloated requirements and lack of focus.

### New Strategy: Modular ERP-like Approach

Instead of one monolithic app, the new approach is:

- **One Shared Backend/Database** — A single database holding core shared data (member profiles, etc.).
- **Multiple Separate Frontends** — Each division (Finance, HR/[[Peops]], [[Marcomms]]) gets its own dedicated client app consuming the same backend API.
- **Current Focus: Finance Dashboard first.** Once stable, expand to other divisions using the exact same backend infrastructure.

### Deployment & Workflow

- Self-hosted on organization's own **VPS** with a custom domain.
- AI-assisted development workflow.

---

## 2. Revenue & Expense Profile

### Where Money Comes In (Income)

| Source                                | Description                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| **[[Uang Kas]] Anggota**              | Monthly member dues. Regular rate: **Rp15.000/bulan**. Leniency available (see below). |
| **Veteran External Project (Vexpro)** | Organization acts as IT consultant — building websites/systems for external clients.   |
| **Business Development (Busdev)**     | External projects managed by Busdev division.                                          |
| **Merchandise Sales**                 | Organization merchandise (design, production, sales).                                  |
| **Study Club (Public)**               | Public-facing study club sessions — TBD on monetization details.                       |
| **Hibah**                             | Grants — rare/occasional.                                                              |
| **Dana Pagu (Universitas)**           | University-allocated funds — depends on internal vs external usage.                    |

### Where Money Goes Out (Expenses)

Most spending goes to **Program Kerja (Work Programs)** — primarily events. Expense categories include:

- Domain & hosting
- Perlengkapan (equipment/supplies)
- Konsumsi (food & beverage)
- Transport
- Logistik
- Lain-lain (miscellaneous)

---

## 3. Finance Division Structure

| Role              | Scope                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| **[[Finance 1]]** | Operational scope for internal money — [[Uang Kas]], Merchandise         |
| **[[Finance 2]]** | Operational scope for external money — Busdev, Vexpro, Study Club, Hibah |

Dana Pagu (university funds) goes to [[Finance 1]] if internal, [[Finance 2]] if external. Finance 1 and Finance 2 are not separate MVP dashboard roles; access still follows [[RBAC Permission Matrix]].

---

## 4. Feature Requirements (As-Is → To-Be)

### 4.1 [[Uang Kas]] (Member Dues) Management

**As-Is:**

- Monthly payment of Rp15.000 per member.
- Top point member of the month gets **Rp0 (exempt)**.
- Leniency cases exist — manual adjustment per member:
  - Could be reduced to Rp5.000 for 12 full months.
  - Or reduced to a specific nominal for certain months (case-by-case discussion between finance & member).
- Bookkeeping done in Google Sheets — tracked per month per member (paid/unpaid).
- Payment reminders are **manual**.

**To-Be (Dashboard Features):**

- Member-facing payment portal:
  - Input: Nama, NIM, Angkatan, Tujuan Pembayaran (BNI/Gopay), Bulan (multi-select), Upload Bukti (file).
- Finance-facing admin panel:
  - View all member payment statuses per month.
  - Configure leniency rules per member (custom nominal, duration).
  - Mark top-point exemptions.
  - Automated/semi-automated reminders.
- Payment status monitoring for members (self-service check).

> **Note:** Actual bank transfers happen **outside** the app (e.g., manual transfer via BNI/Gopay). The dashboard only records and tracks, not processes payments.

### 4.2 Merchandise Operations

**As-Is (Sheets-based):**

- Product input: Nama Produk, Nama Merch, Link Design, Harga Beli, Harga Jual, Pembulatan, Profit, Stok.
- On purchase: reduce stock in sheets, record to cashflow.

**To-Be:**

- Product catalog management (CRUD).
- Auto stock deduction on recorded sale.
- Auto cashflow entry on sale.
- Profit margin tracking per product.

### 4.3 Project & External Finance ([[Finance 2]])

**As-Is:**

- Simple per-project recap: Project A debit Rp1.000.000, Project B kredit Rp250.000.
- Applies to Busdev and Vexpro.
- Study Club tracking is TBD / not yet clear.
- Hibah is rare.

**To-Be:**

- Per-project financial ledger.
- Simple debit/kredit tracking per project.
- Project-level P&L view.

### 4.4 [[Reimbursement]] System

**As-Is:**

- Finance receives reimbursement request → Approve/Reject → Record to cashflow (manual) → Transfer (outside app) → Update status & bukti transfer.

**To-Be — Member-Facing:**

- Reimbursement request form:
  - Nama, NIM, Angkatan
  - Judul Kegiatan (purpose)
  - Kategori Program Kerja (dropdown)
  - Jenis Biaya: Transport / Konsum / Logistik / Lain-lain
  - Nominal
  - Bukti Pembelian (file upload)
  - Tujuan Pembayaran: Bank (BNI / Jago) atau Gopay
- Status monitoring: Approved / Rejected / Pending
- View bukti transfer if approved.

**To-Be — Finance-Facing:**

- Reimbursement queue with approve/reject workflow.
- Auto-record to cashflow on approval.
- Upload bukti transfer after manual payment.

### 4.5 [[Cashflow Ledger|Cash Flow Tracking]]

**As-Is (Sheets):**

- **Pemasukan (Income):** Kategori, Jumlah Terjual, Harga Jual Per-Item, Total, Metode Pembayaran, Bukti Pemasukan.
- **Pengeluaran (Expense):** Nama, Jumlah (pcs/box/bal/etc.), Jumlah Biaya.

**To-Be (Dashboard):**

- Full income & expense ledger with categorization.
- Purchase type categorization (Domain, Perlap, Konsumsi, etc.).
- Monthly P&L (Profit & Loss) cashflow statement.
- Payment method tracking.
- Bukti (receipt/proof) attachment per entry.

### 4.6 [[Transparency Dashboard]] (Member-Facing)

This was a key request from leadership — **benchmarking to MyBCA / GoPay expense tracker** style UX.

**Features:**

- Members can view organizational financial activity.
- Categorized purchase breakdown (what type of spending).
- Monthly P&L cashflow view.
- **Charts & Visualizations:**
  - Week-on-week cashflow graph.
  - Month-on-month cashflow graph.
  - Income breakdown by category (pie/bar chart).
  - Expense breakdown by category (pie/bar chart).
- Storytelling approach — not just raw data, but contextual, interactive, and detailed.

---

## 5. User Roles & Permissions

| Role            | Access                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **[[Member]]**  | Pay uang kas, request reimburse, monitor own payment/reimburse status, view full transparency dashboard     |
| **[[Finance]]** | Member access plus validate kas, approve/reject reimbursements, record cashflow, manage categories/programs |

[[Finance 1]], [[Finance 2]], Ketua, Sekretaris, Kadiv, staff, and [[BPH]] are organizational labels, not separate MVP dashboard roles. Anyone who is not assigned [[Finance]] uses [[Member]] access.

---

## 6. Architecture Decision: Not a Full Accounting System

### The Question

> "Should we build a full accounting system, or is that overkill for an organisasi mahasiswa?"

### The Answer

A full double-entry accounting system (jurnal umum, buku besar, neraca, laporan laba rugi formal) is **overkill** for this context. VeteranTech is a nonprofit student org, not a PT (company).

### What We're Building Instead

A **smart expense & income tracker with categorization and visualization** — inspired by consumer finance apps (GoPay, MyBCA) rather than enterprise accounting software. Think of it as:

- **Cashflow tracker** (income in, expenses out) ✅
- **Categorized ledger** (what type of income/expense) ✅
- **P&L summaries** (monthly, simple format) ✅
- **Visual dashboards** (charts, graphs, storytelling) ✅
- **Member payment management** (uang kas + reimbursements) ✅
- **NOT:** Double-entry bookkeeping, formal balance sheets, tax reporting, depreciation ❌

---

## 7. Data Model (High-Level Entities)

Members (shared across all modules)
├── id, nama, nim, angkatan, status
│
├── Users (auth)
│ └── id, member_id, username/NIM, password_hash, must_change_password, last_login
│
├── UangKasConfig (per member)
│ └── member_id, monthly_nominal, leniency_type, start_date, end_date, notes
│
├── UangKasPayments
│ └── id, member_id, bulan, tahun, nominal, status, bukti_url, paid_at, verified_by
│
├── MerchProducts
│ └── id, nama, design_url, harga_beli, harga_jual, stok
│
├── MerchSales
│ └── id, product_id, qty, total, payment_method, bukti_url, created_at
│
├── Projects (Busdev, Vexpro, etc.)
│ └── id, nama, type, status
│
├── ProjectTransactions
│ └── id, project_id, type(debit/kredit), nominal, description, date
│
├── ReimbursementRequests
│ └── id, member_id, judul_kegiatan, kategori_proker, jenis_biaya,
│ nominal, bukti_pembelian_url, tujuan_pembayaran, status,
│ bukti_transfer_url, approved_by, created_at
│
├── CashFlowEntries
│ └── id, type(income/expense), kategori, nama, jumlah, nominal,
│ total, payment_method, bukti_url, source_type, source_id, date
│
└── TopPointExemptions
└── id, member_id, bulan, tahun, reason

---

## 8. MVP Scope (Phase 1 Recommendation)

To avoid repeating the bloated portal mistake, Phase 1 should be split into smaller releases:

| Phase    | Feature                                    | Rationale                                               |
| -------- | ------------------------------------------ | ------------------------------------------------------- |
| Phase 1a | Member database (shared)                   | Foundation for everything                               |
| Phase 1a | [[Uang Kas]] tracking & payment recording  | Core finance operation                                  |
| Phase 1a | Basic [[Cashflow Ledger]] (income/expense) | Replaces current sheets                                 |
| Phase 1a | [[Transparency Dashboard]] with charts     | Leadership priority ("disuruh ketua")                   |
| Phase 1b | [[Reimbursement]] request & approval flow  | High-frequency pain point, but adds workflow complexity |
| Phase 1b | Merchandise management                     | Lower frequency, sheets still workable                  |
| Phase 2  | Project finance (Busdev/Vexpro)            | Simpler tracking, can wait                              |
| Phase 2  | Automated payment reminders                | Nice-to-have, manual still works                        |
| Phase 2  | Study Club finance tracking                | TBD / not yet clear                                     |

---

## 9. Key Design Principles

1. **Sheets-killer, not ERP.** Replace Google Sheets with something better — not SAP.
2. **GoPay/MyBCA as UX benchmark.** Clean, visual, storytelling-driven finance view.
3. **Payments happen outside.** The app tracks, not transacts. No payment gateway needed.
4. **Modular backend.** Member data is shared; finance is the first frontend. HR/[[Peops]] and [[Marcomms]] come later on the same API.
5. **AI-assisted development.** Leverage AI tools heavily in build process.
6. **Progressive complexity.** Start simple, add features based on actual usage and feedback.

---

## 10. Open Questions & Next Steps

- [ ] Finalize Study Club finance tracking requirements for Phase 2.
- [ ] Define exact top-point criteria and who manages exemptions.
- [x] Decide tech stack: Next.js + PostgreSQL + [[Drizzle]]. See [[Tech Stack Decisions]].
- [x] Draft database schema in detail. See [[Shared ERP Backend]].
- [ ] Create Figma wireframes for member-facing and finance-facing views.
- [ ] Define API contract for shared backend.
- [ ] Alya (Protech) collaboration — finance team to assist with development bandwidth.

---

_This document is a living draft. Updated as discussions progress._
