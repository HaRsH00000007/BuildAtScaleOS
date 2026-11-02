-- Task Pipeline sheet columns (2026-11-02). Additive only: preview link and first submission date/time.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "previewLink" TEXT,
ADD COLUMN     "firstSubmittedDate" TIMESTAMP(3),
ADD COLUMN     "firstSubmittedTime" TEXT;
