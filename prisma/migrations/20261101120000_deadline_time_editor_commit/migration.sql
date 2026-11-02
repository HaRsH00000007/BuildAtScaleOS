-- Task Pipeline sheet columns (2026-11-01). Additive only: deadline time and the editor's committed date/time.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "deadlineTime" TEXT,
ADD COLUMN     "committedDate" TIMESTAMP(3),
ADD COLUMN     "committedTime" TEXT;
