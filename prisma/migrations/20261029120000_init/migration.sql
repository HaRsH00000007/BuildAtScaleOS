-- Ops Tracker: first migration of the standalone database (split from the OpsCentral platform, 2026-10-29).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Project IDs (PRJ-001…) and task IDs (TSK-001…) come from sequences, so every way of creating a row gets one.
CREATE SEQUENCE "project_code_seq";
CREATE SEQUENCE "task_code_seq";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'EXITED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('MEMBER', 'MANAGER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PIPELINE', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'ON_HOLD', 'REJECTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskEventKind" AS ENUM ('STATUS', 'PRIORITY', 'REVIEWER', 'BLOCKER');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "empCode" TEXT,
    "designation" TEXT,
    "phone" TEXT,
    "joinDate" DATE,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "departmentId" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "TaskType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT DEFAULT ('PRJ-'::text || lpad((nextval('project_code_seq'::regclass))::text, 3, '0'::text)),
    "clientId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT ('TSK-'::text || lpad((nextval('task_code_seq'::regclass))::text, 3, '0'::text)),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "taskTypeId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PIPELINE',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "estimatedHours" DECIMAL(8,2),
    "reviewerId" TEXT,
    "startDate" TIMESTAMP(3),
    "underReviewAt" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "blockerTypeId" TEXT,
    "blockerNote" TEXT,
    "clientAction" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockerType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TaskEventKind" NOT NULL,
    "action" TEXT,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "date" DATE NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL DEFAULT 'org',
    "name" TEXT NOT NULL DEFAULT 'Ops Tracker',
    "taskApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveTasks" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveMaxHours" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_empCode_key" ON "User"("empCode");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskType_departmentId_name_key" ON "TaskType"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_code_key" ON "Task"("code");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BlockerType_name_key" ON "BlockerType"("name");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_date_idx" ON "TimeEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_date_idx" ON "TimeEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskType" ADD CONSTRAINT "TaskType_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_blockerTypeId_fkey" FOREIGN KEY ("blockerTypeId") REFERENCES "BlockerType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockerType" ADD CONSTRAINT "BlockerType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Default roles. Keep in step with DEFAULT_ROLES in src/lib/permissions.ts (permissions.test.ts checks the names).
INSERT INTO "Role" ("id", "name", "description", "permissions", "isSystem", "updatedAt") VALUES
    ('role_management', 'Management', 'Full access', ARRAY['people.manage','clients.manage','projects.view_all','projects.manage','tasks.view_all','tasks.manage','settings.manage','ops.view','ops.manage','ops.performance','ops.rpa'], true, NOW()),
    ('role_operations', 'Operations', 'Runs delivery across projects', ARRAY['people.manage','clients.manage','projects.view_all','projects.manage','tasks.view_all','tasks.manage','ops.view','ops.manage','ops.rpa'], true, NOW()),
    ('role_hr', 'HR', 'People operations', ARRAY['people.manage','ops.view','ops.performance'], true, NOW()),
    ('role_manager', 'Manager', 'Manages projects and a team', ARRAY['projects.manage','tasks.manage','ops.view','ops.manage','ops.rpa'], true, NOW()),
    ('role_team_lead', 'Team Lead', 'Leads a team', ARRAY['tasks.manage','ops.view','ops.manage'], true, NOW()),
    ('role_employee', 'Employee', 'Default role', ARRAY['ops.view'], true, NOW());

-- Blocker reasons (the platform's list; ids kept so data moved from the platform matches).
INSERT INTO "BlockerType" ("id", "name") VALUES
    ('SCOPE_CLARIFICATION', 'Scope clarification'),
    ('ASSET_DEPENDENCY', 'Asset dependency'),
    ('TECHNICAL_BLOCKER', 'Technical blocker'),
    ('CLIENT_FEEDBACK', 'Client dependency'),
    ('INTERNAL_REVIEW', 'Internal review');

-- Settings row.
INSERT INTO "OrgSettings" ("id", "updatedAt") VALUES ('org', NOW());
