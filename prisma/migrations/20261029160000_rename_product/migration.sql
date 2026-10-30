-- Product renamed from Ops Tracker to BuildAtScaleOS (2026-10-29). Keeps an organisation name someone already changed.
ALTER TABLE "OrgSettings" ALTER COLUMN "name" SET DEFAULT 'BuildAtScaleOS';
UPDATE "OrgSettings" SET "name" = 'BuildAtScaleOS' WHERE "name" = 'Ops Tracker';
