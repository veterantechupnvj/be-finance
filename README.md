# be-finance

Backend API untuk **VeteranTech Finance Dashboard**, dibangun dengan **Bun** + **Hono** + **custom JWT auth** + **Drizzle ORM**.

Project ini adalah backend modular untuk organisasi VeteranTech UPNVJ. Finance Dashboard menjadi client pertama, lalu ke depannya backend dan database yang sama bisa dipakai juga oleh modul lain.

## Stack

| Layer      | Tech                          |
| ---------- | ----------------------------- |
| Runtime    | Bun                           |
| Framework  | Hono                          |
| OpenAPI    | `@hono/zod-openapi` + Scalar  |
| Auth       | Custom JWT (`nim` + password) |
| ORM        | Drizzle ORM                   |
| Database   | PostgreSQL 16                 |
| Validation | Zod                           |
| Linting    | Oxlint + Oxfmt                |

## Karakter Sistem

Backend ini dibuat untuk kebutuhan organisasi, bukan full accounting system. Fokus utamanya:

- tracking pemasukan dan pengeluaran
- transparansi cashflow untuk member
- pengelolaan uang kas anggota
- reimbursement workflow
- merchandise sales dan stock tracking
- shared member data untuk modul ERP lain

Pembayaran tetap terjadi di luar aplikasi. Sistem ini mencatat, memvalidasi, dan menampilkan aktivitas keuangan, bukan payment gateway.

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Setup environment variables

Buat file `.env` di root project lalu isi nilai yang dibutuhkan.

Contoh:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/be_finance
JWT_SECRET=change-me-to-a-long-random-string
PORT=3000
NODE_ENV=development
```

Variabel yang dipakai saat ini:

| Variable       | Keterangan                               |
| -------------- | ---------------------------------------- |
| `DATABASE_URL` | Connection string PostgreSQL             |
| `JWT_SECRET`   | Secret untuk sign/verify JWT             |
| `PORT`         | Port server, default `3456`              |
| `NODE_ENV`     | `development`, `test`, atau `production` |

Definisi resminya ada di [src/env.ts](src/env.ts).

### 3. Jalankan database

Project ini menyediakan PostgreSQL via Docker Compose:

```bash
bun run db:start
```

Untuk stop database:

```bash
bun run db:stop
```

Kalau perlu reset volume database lokal:

```bash
bun run db:reset
```

### 4. Generate dan jalankan migration

Untuk generate migration lalu langsung apply:

```bash
bun run db:m
```

Kalau ingin dipisah:

```bash
bun run generate
bun run migrate
```

Atau kalau ingin push schema langsung ke database:

```bash
bun run push
```

### 5. Seed admin awal

Kalau butuh akun awal untuk login:

```bash
bun run db:seed-admin
```

### 6. Jalankan dev server

```bash
bun run dev
```

Server akan berjalan di `http://localhost:3456`.

Untuk mode start biasa tanpa hot reload:

```bash
bun run start
```

## API Endpoints

### System

| Method | Endpoint            | Keterangan                  |
| ------ | ------------------- | --------------------------- |
| `GET`  | `/health`           | Health check                |
| `GET`  | `/api/openapi.json` | OpenAPI document            |
| `GET`  | `/reference`        | Scalar interactive API docs |

### Auth

| Method | Endpoint                | Keterangan                          |
| ------ | ----------------------- | ----------------------------------- |
| `POST` | `/auth/login`           | Login dengan `nim` + `password`     |
| `POST` | `/auth/change-password` | Ganti password user                 |
| `POST` | `/auth/logout`          | Logout                              |
| `GET`  | `/auth/me`              | Ambil profil user yang sedang login |

### Members

| Method | Endpoint       | Keterangan    |
| ------ | -------------- | ------------- |
| `GET`  | `/members`     | List member   |
| `GET`  | `/members/:id` | Detail member |

### Reference Data

| Method | Endpoint                    | Keterangan         |
| ------ | --------------------------- | ------------------ |
| `GET`  | `/ref/divisions`            | List divisions     |
| `GET`  | `/ref/staff-periods`        | List staff periods |
| `GET`  | `/ref/staff-periods/active` | Staff period aktif |

### Finance Modules

| Prefix                    | Keterangan                     |
| ------------------------- | ------------------------------ |
| `/finance/categories`     | Kategori pemasukan/pengeluaran |
| `/finance/programs`       | Program kerja dan event        |
| `/finance/cashflow`       | Ledger cashflow dan summary    |
| `/finance/dues`           | Uang kas anggota               |
| `/finance/reimbursements` | Pengajuan reimbursement        |
| `/finance/merch`          | Produk merch dan sales         |

Untuk detail request/response schema, gunakan OpenAPI dan file route/schema di `src/modules/`.

## Dokumentasi API

Generate file OpenAPI:

```bash
bun run openapi:generate
```

Saat server berjalan:

- OpenAPI JSON: [http://localhost:3456/api/openapi.json](http://localhost:3456/api/openapi.json)
- Scalar docs: [http://localhost:3456/reference](http://localhost:3456/reference)

## Project Structure

```text
src/
├── db/                  # Drizzle client, schema, migrations
├── lib/                 # Helper auth, JWT, response, audit, openapi
├── middleware/          # Auth, RBAC, global error handler
├── modules/
│   ├── auth/
│   ├── cashflow/
│   ├── categories/
│   ├── dues/
│   ├── members/
│   ├── merch/
│   ├── programs/
│   ├── ref/
│   └── reimbursements/
├── scripts/             # generate-openapi, seed scripts
├── app.ts               # Mount semua module + system routes
├── env.ts               # Zod env schema dan runtime env parsing
├── factory.ts           # createRouter(), AppEnv, context types
└── index.ts             # Entry point
```

Konvensi file module:

- `[domain].routes.ts` untuk `createRoute()`
- `[domain].handlers.ts` untuk handler tipis
- `[domain].schema.ts` untuk Zod schema
- `[domain].service.ts` hanya jika butuh transaksi, multi-table, atau logic bersama

## Scripts

```bash
bun run dev              # Jalankan server dengan hot reload
bun run start            # Jalankan server normal
bun run build            # Build ke folder dist
bun run db:start         # Start PostgreSQL lokal via docker-compose
bun run db:stop          # Stop PostgreSQL lokal
bun run db:reset         # Reset PostgreSQL lokal
bun run db:m             # Generate + migrate sekaligus
bun run db:seed-admin    # Seed admin awal
bun run generate         # Generate migration files
bun run migrate          # Apply migration
bun run push             # Push schema langsung ke DB
bun run studio           # Buka Drizzle Studio
bun run db:studio        # Alias Drizzle Studio
bun run check            # TypeScript type check
bun run lint             # Lint dengan oxlint
bun run format           # Format dengan oxfmt
bun run format:check     # Cek format
bun run fl               # Lint + format
bun run openapi:generate # Generate openapi.json
```

## Referensi Tambahan

- [docs/API_Contract.md](docs/API_Contract.md)
- [docs/prd.md](docs/prd.md)
- [docs/RBAC Permission Matrix.md](docs/RBAC%20Permission%20Matrix.md)
- [docs/Shared ERP Backend.md](docs/Shared%20ERP%20Backend.md)

## Catatan

Source of truth implementasi backend ada di:

- `src/db/schema/`
- `src/modules/**/**/*.routes.ts`
- `src/modules/**/**/*.schema.ts`
- `openapi.json`
