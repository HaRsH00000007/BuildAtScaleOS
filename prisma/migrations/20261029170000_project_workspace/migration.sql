-- Harmony-style Projects workspace (2026-10-29). Additive only: project type/billable/public/value with defaults,
-- project finance entries, workstreams and an optional task → workstream link. Existing rows are untouched.

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('RETAINER', 'PROJECT', 'PAY_AS_YOU_GO');

-- CreateEnum
CREATE TYPE "FinanceKind" AS ENUM ('OTHER_INCOME', 'DIRECT_EXPENSE', 'ADHOC_EXPENSE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "billingType" "BillingType" NOT NULL DEFAULT 'PROJECT',
ADD COLUMN     "isBillable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "value" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "workstreamId" TEXT;

-- CreateTable
CREATE TABLE "ProjectFinanceEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "FinanceKind" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workstream" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workstream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkstreamMember" (
    "workstreamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WorkstreamMember_pkey" PRIMARY KEY ("workstreamId","userId")
);

-- CreateIndex
CREATE INDEX "ProjectFinanceEntry_projectId_date_idx" ON "ProjectFinanceEntry"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Workstream_projectId_name_key" ON "Workstream"("projectId", "name");

-- AddForeignKey
ALTER TABLE "ProjectFinanceEntry" ADD CONSTRAINT "ProjectFinanceEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFinanceEntry" ADD CONSTRAINT "ProjectFinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

