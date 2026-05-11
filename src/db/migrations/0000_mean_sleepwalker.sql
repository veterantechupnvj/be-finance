CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."member_type" AS ENUM('member', 'staff', 'alumni');--> statement-breakpoint
CREATE TYPE "public"."dues_status" AS ENUM('unpaid', 'pending', 'verified', 'exempt');--> statement-breakpoint
CREATE TYPE "public"."entry_kind" AS ENUM('normal', 'opening_balance', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."fin_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."leniency_type" AS ENUM('none', 'reduced_fixed', 'reduced_temporary');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bni', 'gopay', 'cash');--> statement-breakpoint
CREATE TYPE "public"."reimbursement_payment_dest" AS ENUM('bni', 'gopay');--> statement-breakpoint
CREATE TYPE "public"."reimbursement_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."position" AS ENUM('president', 'vice_president', 'division_head', 'deputy_division_head', 'staff');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('planning', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."program_type" AS ENUM('event', 'recurring', 'external', 'flagship');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_member_role" UNIQUE("member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"nim" varchar(50) NOT NULL,
	"cohort_year" integer NOT NULL,
	"member_type" "member_type" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_nim_unique" UNIQUE("nim")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_member_id_unique" UNIQUE("member_id"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "fin_cashflow_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "fin_type" NOT NULL,
	"entry_kind" "entry_kind" DEFAULT 'normal' NOT NULL,
	"category_id" uuid NOT NULL,
	"program_id" uuid,
	"description" varchar(500) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"receipt_url" varchar(500),
	"source_id" uuid,
	"recorded_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_by" uuid,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "fin_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "fin_type" NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_dues_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_period_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"monthly_amount" numeric(15, 2) NOT NULL,
	"leniency_type" "leniency_type" DEFAULT 'none' NOT NULL,
	"leniency_start" date,
	"leniency_end" date,
	"notes" text,
	"configured_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_dues_config_member_period" UNIQUE("staff_period_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "fin_member_dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"dues_config_id" uuid,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" "dues_status" DEFAULT 'unpaid' NOT NULL,
	"exempt_reason" varchar(255),
	"receipt_url" varchar(500),
	"payment_method" "payment_method",
	"paid_at" timestamp with time zone,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"cashflow_entry_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_reason" text,
	CONSTRAINT "uq_member_dues_month" UNIQUE("member_id","month","year")
);
--> statement-breakpoint
CREATE TABLE "fin_merch_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"merch_line" varchar(255),
	"design_url" varchar(500),
	"cost_price" numeric(15, 2) NOT NULL,
	"selling_price" numeric(15, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "fin_merch_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"buyer_member_id" uuid,
	"buyer_name" varchar(255),
	"qty" integer NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"receipt_url" varchar(500),
	"cashflow_entry_id" uuid,
	"recorded_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_by" uuid,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "fin_reimbursement_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"program_id" uuid,
	"category_id" uuid NOT NULL,
	"activity_title" varchar(255) NOT NULL,
	"description" text,
	"amount" numeric(15, 2) NOT NULL,
	"purchase_receipt_url" varchar(500) NOT NULL,
	"payment_destination" "reimbursement_payment_dest" NOT NULL,
	"account_info" varchar(100) NOT NULL,
	"status" "reimbursement_status" DEFAULT 'submitted' NOT NULL,
	"rejection_reason" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"transfer_receipt_url" varchar(500),
	"paid_at" timestamp with time zone,
	"cashflow_entry_id" uuid,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"division_id" uuid NOT NULL,
	"position" "position" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_staff_member" UNIQUE("staff_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "staff_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "program_type" NOT NULL,
	"division_id" uuid,
	"budget" numeric(15, 2),
	"status" "program_status" DEFAULT 'planning' NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_assigned_by_members_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_cashflow_entries" ADD CONSTRAINT "fin_cashflow_entries_category_id_fin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fin_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_cashflow_entries" ADD CONSTRAINT "fin_cashflow_entries_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_cashflow_entries" ADD CONSTRAINT "fin_cashflow_entries_recorded_by_members_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_cashflow_entries" ADD CONSTRAINT "fin_cashflow_entries_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_cashflow_entries" ADD CONSTRAINT "fin_cashflow_entries_deleted_by_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_categories" ADD CONSTRAINT "fin_categories_parent_id_fin_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."fin_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_dues_config" ADD CONSTRAINT "fin_dues_config_staff_period_id_staff_periods_id_fk" FOREIGN KEY ("staff_period_id") REFERENCES "public"."staff_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_dues_config" ADD CONSTRAINT "fin_dues_config_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_dues_config" ADD CONSTRAINT "fin_dues_config_configured_by_members_id_fk" FOREIGN KEY ("configured_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_dues_config" ADD CONSTRAINT "fin_dues_config_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_member_dues" ADD CONSTRAINT "fin_member_dues_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_member_dues" ADD CONSTRAINT "fin_member_dues_dues_config_id_fin_dues_config_id_fk" FOREIGN KEY ("dues_config_id") REFERENCES "public"."fin_dues_config"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_member_dues" ADD CONSTRAINT "fin_member_dues_verified_by_members_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_member_dues" ADD CONSTRAINT "fin_member_dues_cashflow_entry_id_fin_cashflow_entries_id_fk" FOREIGN KEY ("cashflow_entry_id") REFERENCES "public"."fin_cashflow_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_member_dues" ADD CONSTRAINT "fin_member_dues_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_member_dues" ADD CONSTRAINT "fin_member_dues_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_member_dues" ADD CONSTRAINT "fin_member_dues_deleted_by_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_products" ADD CONSTRAINT "fin_merch_products_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_products" ADD CONSTRAINT "fin_merch_products_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_products" ADD CONSTRAINT "fin_merch_products_deleted_by_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_sales" ADD CONSTRAINT "fin_merch_sales_product_id_fin_merch_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."fin_merch_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_sales" ADD CONSTRAINT "fin_merch_sales_buyer_member_id_members_id_fk" FOREIGN KEY ("buyer_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_sales" ADD CONSTRAINT "fin_merch_sales_cashflow_entry_id_fin_cashflow_entries_id_fk" FOREIGN KEY ("cashflow_entry_id") REFERENCES "public"."fin_cashflow_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_sales" ADD CONSTRAINT "fin_merch_sales_recorded_by_members_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_sales" ADD CONSTRAINT "fin_merch_sales_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_merch_sales" ADD CONSTRAINT "fin_merch_sales_deleted_by_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_category_id_fin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fin_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_approved_by_members_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_cashflow_entry_id_fin_cashflow_entries_id_fk" FOREIGN KEY ("cashflow_entry_id") REFERENCES "public"."fin_cashflow_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_reimbursement_requests" ADD CONSTRAINT "fin_reimbursement_requests_deleted_by_members_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_staff_id_staff_periods_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;