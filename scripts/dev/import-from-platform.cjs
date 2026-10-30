// One-off copy of the Ops data from the OpsCentral platform database into this app's database.
// Usage (from this folder): node scripts/dev/import-from-platform.cjs "<platform folder>" "$PWD"
//
// Reads the platform's DATABASE_URL from <platform folder>/.env and this app's from ./.env. Copies, keeping ids:
// departments, task types, people (with their password hashes, so platform logins keep working), clients, projects,
// project members, blocker reasons, tasks, task history and time entries. Only columns this app has are copied
// (no billing, payroll or personal HR fields). Sessions are not copied; everyone signs in again.
// - Roles are matched by name; a platform role with no match here (Finance, Product Development) becomes Employee. (A)
// - A platform person whose email already exists here is merged into the existing account (that account is kept).
// - Refuses to run if this database already has projects or tasks, so it can't create duplicates.
// - Afterwards the PRJ/TSK number sequences continue after the highest imported code.
const fs = require("fs");
const path = require("path");

const [platformDir, appDir] = process.argv.slice(2);
if (!platformDir || !appDir) {
  console.error('Usage: node scripts/dev/import-from-platform.cjs "<platform folder>" "$PWD"');
  process.exit(1);
}
const readUrl = (dir) => {
  const m = fs.readFileSync(path.join(dir, ".env"), "utf8").match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!m) throw new Error(`No DATABASE_URL in ${dir}/.env`);
  return m[1];
};
const { PrismaClient } = require(path.join(appDir, "node_modules/@prisma/client"));
const src = new PrismaClient({ datasources: { db: { url: readUrl(platformDir) } } });
const dst = new PrismaClient({ datasources: { db: { url: readUrl(appDir) } } });

// Table → model delegate, in insert order (parents first).
const TABLES = [
  ["Department", "department"],
  ["User", "user"],
  ["TaskType", "taskType"],
  ["Client", "client"],
  ["Project", "project"],
  ["ProjectMember", "projectMember"],
  ["BlockerType", "blockerType"],
  ["Task", "task"],
  ["TaskEvent", "taskEvent"],
  ["TimeEntry", "timeEntry"],
];
const USER_FKS = { User: ["managerId"], ProjectMember: ["userId"], BlockerType: ["createdById"], Task: ["assigneeId", "assignedById", "reviewerId"], TaskEvent: ["userId"], TimeEntry: ["userId"] };

async function columns(client, table) {
  const rows = await client.$queryRawUnsafe(
    `select column_name c from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    table,
  );
  return rows.map((r) => r.c);
}
// Raw rows come back with the platform client's Decimal objects; pass them on as strings.
const plain = (v) => (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && typeof v.toFixed === "function" ? v.toString() : v);

async function main() {
  const [projects, tasks] = await Promise.all([dst.project.count(), dst.task.count()]);
  if (projects || tasks) throw new Error(`This database already has ${projects} projects and ${tasks} tasks; import refused.`);

  const roles = await dst.role.findMany({ select: { id: true, name: true } });
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));
  const employeeRole = roleByName.get("Employee");
  const srcRoles = new Map((await src.$queryRawUnsafe(`select id, name from "Role"`)).map((r) => [r.id, r.name]));

  const existing = new Map((await dst.user.findMany({ select: { id: true, email: true } })).map((u) => [u.email.toLowerCase(), u.id]));
  const userIdMap = new Map(); // platform user id → id here (differs only for merged accounts)
  const existingBlockers = new Set((await dst.blockerType.findMany({ select: { id: true } })).map((b) => b.id));

  const data = {};
  for (const [table] of TABLES) {
    const want = new Set(await columns(dst, table));
    const have = (await columns(src, table)).filter((c) => want.has(c));
    const rows = await src.$queryRawUnsafe(`select ${have.map((c) => `"${c}"`).join(", ")} from "${table}"`);
    data[table] = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)])));
  }

  const remapped = [];
  for (const u of data.User) {
    const name = srcRoles.get(u.roleId);
    u.roleId = roleByName.get(name) ?? employeeRole;
    if (!roleByName.has(name)) remapped.push(`${u.email} (${name} → Employee)`);
    const here = existing.get(u.email.toLowerCase());
    userIdMap.set(u.id, here ?? u.id);
  }
  const merged = data.User.filter((u) => existing.has(u.email.toLowerCase()));
  data.User = data.User.filter((u) => !existing.has(u.email.toLowerCase()));
  const managers = data.User.map((u) => ({ id: u.id, managerId: u.managerId })).filter((u) => u.managerId);
  for (const u of data.User) u.managerId = null; // set after every user exists
  for (const [table, fks] of Object.entries(USER_FKS))
    for (const row of data[table]) for (const fk of fks) if (row[fk]) row[fk] = userIdMap.get(row[fk]) ?? row[fk];
  data.BlockerType = data.BlockerType.filter((b) => !existingBlockers.has(b.id));

  await dst.$transaction(
    async (tx) => {
      for (const [table, model] of TABLES) if (data[table].length) await tx[model].createMany({ data: data[table] });
      for (const m of managers) await tx.user.update({ where: { id: m.id }, data: { managerId: userIdMap.get(m.managerId) ?? m.managerId } });
      // Continue PRJ-/TSK- numbering after the highest imported code.
      for (const [seq, table, prefix] of [["project_code_seq", "Project", "PRJ-"], ["task_code_seq", "Task", "TSK-"]]) {
        const [{ n }] = await tx.$queryRawUnsafe(
          `select coalesce(max(substring(code from '^${prefix}(\\d+)$')::int), 0) n from "${table}"`,
        );
        if (n > 0) await tx.$executeRawUnsafe(`select setval('${seq}', ${n})`);
      }
    },
    { timeout: 60000 },
  );

  for (const [table] of TABLES) console.log(`${table}: ${data[table].length} copied`);
  if (merged.length) console.log(`Merged into existing accounts: ${merged.map((u) => u.email).join(", ")}`);
  if (remapped.length) console.log(`Role changed: ${remapped.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([src.$disconnect(), dst.$disconnect()]));
