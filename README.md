# BuildAtScaleOS

BuildAtScaleOS (formerly Ops Tracker) is a standalone app for running delivery: projects, tasks, the Ops Tracker Overview, Task Pipeline and Portfolio, plus the people and clients
they need. It was split out of the OpsCentral platform (`../Harmony-Reverse-Engineering`) on 2026-10-29 and no longer
depends on it: own code, own database, own sign-in.

**Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript 5.9, Tailwind 4, zod, Prisma 6, PostgreSQL, Vitest.

## What's in it

| Area | Routes | Who |
|---|---|---|
| Ops Tracker | `/ops/overview`, `/ops/portfolio` | `ops.manage` |
| | `/ops/pipeline` (+ CSV export), `/ops/daily-desk`, `/ops/delivery-canvas`, `/ops/performance` | `ops.view` (everyone) |
| | `/ops/client-rpa` | `ops.rpa` |
| Projects | `/projects` (opens the first project), `/projects/new` (3-step wizard), `/projects/[id]?tab=…` (workspace), `/projects/[id]/edit` | members and public projects; `projects.view_all` sees all; `projects.manage` creates and edits; money shows to project managers and `ops.manage` |
| My Tasks | `/my-tasks` (board/list, CSV), `/my-tasks/new`, `/my-tasks/[id]`, `/my-tasks/complete` | everyone |
| Admin | `/people`, `/departments` (with task types) | `people.manage` |
| | `/clients` | `clients.manage` |
| | `/settings` (organisation name, task approval rules, roles and permissions) | `settings.manage` |

Daily Desk, Delivery Canvas, Performance and Client RPA are still placeholders (see `docs/Ops_Tracker_Feature_Plan.pdf`).

### Ops Tracker status

| Screen | Status |
|---|---|
| Overview (executive dashboard) | Done |
| Portfolio | Done |
| Task Pipeline | Done |
| Daily Desk, Delivery Canvas, Performance, Client RPA | Placeholders |

**Overview** (`/ops/overview`, managers): one month filter drives everything on the page, using the Task Pipeline's
Month rule for tasks and the Portfolio's rule for projects.

- **KPI cards:** active projects, pipeline tasks, org on-time rate against the 85% target, and overdue tasks. Each card
  opens the matching filtered Portfolio or Pipeline view.
- **Charts:** task status ring, delivery SLA split and project health mix.
- **Project health & milestones tracker:** search, client/lead/status/health filters and sorting; rows open the
  project workspace.
- **At-risk escalation radar:** open tasks that are overdue or blocked, oldest first. More than 7 days overdue is
  critical. Rows open the task in the Task Pipeline.

The rules live in `src/lib/ops-overview.ts` and reuse `ops-metrics`, `ops-portfolio` and `project-health`, so the
figures agree with the other screens.

The Projects workspace follows Harmony: project list on the left; header, KPI strip, Workstreams and tabs on the right.
Overview, Tasks, Members and Expenses work; Files, Deliverables, Notes, Discussion and Invoices are placeholders.
Project type, billable/public, project value, other income and expenses, and workstreams came back from the platform
on 2026-10-29 (migration `20261029170000_project_workspace`).

**Not included (stayed in the platform):** invoicing, contract approval, department hour allocations, cost rates (so no
labour cost or current profit), project templates and scopes, payroll, attendance, leaves, CRM, deliverables, files,
notes, notifications, analytics.

## Layout

```
prisma/schema.prisma            data model (users, roles, sessions, departments, task types, clients,
                                projects, members, tasks, blocker types, task events, time entries, settings)
prisma/migrations/              20261029120000_init: tables, PRJ/TSK id sequences, default roles,
                                blocker reasons, settings row
src/app/login, forbidden        sign-in and the no-access page
src/app/(app)/ops/              Ops Tracker screens and their server actions
src/app/(app)/projects/         Projects: navigator, workspace and tabs, creation wizard, workstreams
src/app/(app)/my-tasks/         task board, forms, time log
src/app/(app)/people|departments|clients|settings/   admin
src/lib/                        auth, permissions, task workflow, Ops rules (ops-metrics, ops-pipeline,
                                ops-portfolio, ops-overview), helpers. Pure modules have *.test.ts next to them.
src/components/                 UI pieces (sidebar, forms, buttons, timer, month picker)
scripts/db.mjs                  local PostgreSQL cluster (init, start, stop, status)
scripts/dev/                    create-user, session, smoke
```

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and point `DATABASE_URL` at an **empty** PostgreSQL database.
   Locally, `npm run db:init` creates the app's own cluster in `.pgdata` (127.0.0.1:5434, user and database
   `opstracker`), which is what `.env.example` points at; it needs `PG_BIN` set to a PostgreSQL bin directory (or
   the PostgreSQL tools on `PATH`). After that, `npm run db:start` / `db:stop` / `db:status` each day.
   In production, use any hosted PostgreSQL.
3. `npm run db:migrate` (that is `prisma migrate deploy`), then `npx prisma generate` with the dev server stopped.
4. Create the owner account (you choose the password; it isn't stored anywhere else):
   `NEW_EMAIL=you@company.com NEW_PASSWORD=... NEW_NAME="Your Name" node scripts/dev/create-user.cjs "$PWD"`
5. `npm run db:start` (if it isn't running), then `npm run dev` → http://localhost:3100. Sign in, then add departments, clients and people from the Admin menu.

**Copying data from the platform (one-off):** `node scripts/dev/import-from-platform.cjs "../Harmony-Reverse-Engineering" "$PWD"`
copies departments, task types, people (same passwords), clients, projects, members, tasks, task history and time
entries, keeping ids and PRJ/TSK codes. It refuses to run if this database already has projects or tasks. Done locally
on 2026-10-29 (12 people, 6 projects, 66 tasks, 197 time entries; Finance role → Employee).

## Checks

| Check | Command |
|---|---|
| Typecheck | `npm run lint` |
| Unit tests | `npm test` |
| Page smoke test (dev server running) | `node scripts/dev/smoke.mjs <email> "$PWD"` |

## Rules

- Business rules are marked **V** (verified on the Work In Harmony demo, with an REA evidence id, inherited from the
  platform) or **A** (our assumption) in code comments. Ops Tracker rules are all A, from the plan PDF.
- Default roles live in two places that must agree: `DEFAULT_ROLES` in `src/lib/permissions.ts` and the role rows in
  the init migration. `src/lib/migration-roles.test.ts` fails if they drift.
- Never commit `.env`. Never print passwords, session tokens or cookies.
