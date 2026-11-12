-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MOCK_PROVIDER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL,
    "searches" INTEGER NOT NULL,
    "route_builds" INTEGER NOT NULL,
    "calls" INTEGER NOT NULL,
    "website_clicks" INTEGER NOT NULL,
    "new_reviews_count" INTEGER NOT NULL,
    "average_rating" DECIMAL(3,2),
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'RUNNING',
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "error_message" TEXT,
    "triggered_by_id" UUID,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_external_id_key" ON "branches"("external_id");

-- CreateIndex
CREATE INDEX "branches_company_id_idx" ON "branches"("company_id");

-- CreateIndex
CREATE INDEX "daily_metrics_branch_id_date_idx" ON "daily_metrics"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_branch_id_date_key" ON "daily_metrics"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_source_external_id_key" ON "daily_metrics"("source", "external_id");

-- CreateIndex
CREATE INDEX "reviews_branch_id_published_at_idx" ON "reviews"("branch_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_replaced_by_id_key" ON "refresh_sessions"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_revoked_at_expires_at_idx" ON "refresh_sessions"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");

-- CreateIndex
CREATE INDEX "import_runs_triggered_by_id_idx" ON "import_runs"("triggered_by_id");

-- CreateIndex
CREATE INDEX "import_runs_source_started_at_idx" ON "import_runs"("source", "started_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants not expressible in the Prisma schema.
ALTER TABLE "users" ADD CONSTRAINT "users_role_company_check"
CHECK (("role" = 'ADMIN' AND "company_id" IS NULL) OR ("role" = 'CLIENT' AND "company_id" IS NOT NULL));

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check"
CHECK ("email" = lower("email"));

ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_nonnegative_check"
CHECK (
    "views" >= 0 AND "searches" >= 0 AND "route_builds" >= 0 AND "calls" >= 0
    AND "website_clicks" >= 0 AND "new_reviews_count" >= 0
);

ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_rating_check"
CHECK (
    ("new_reviews_count" = 0 AND "average_rating" IS NULL)
    OR ("new_reviews_count" > 0 AND "average_rating" BETWEEN 1 AND 5)
);

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check"
CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_date_range_check"
CHECK ("date_from" <= "date_to");

ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_counts_nonnegative_check"
CHECK ("created_count" >= 0 AND "updated_count" >= 0 AND "skipped_count" >= 0);
