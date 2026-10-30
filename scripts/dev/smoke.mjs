// Authenticated smoke test: creates a throwaway session for an existing user directly in the DB, requests every page,
// and reports status codes / error markers. Usage: node smoke.mjs <email> <projectDir> [baseUrl]
// Routes that need a record (a project, task, person) are skipped when the database has none.
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
const [email, dir, base = "http://localhost:3100"] = process.argv.slice(2);
const require = createRequire(dir + "/package.json");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const user = await db.user.findUniqueOrThrow({ where: { email } });
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
await db.session.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });
const pick = async (model) => (await db[model].findFirst())?.id;
const ids = { project: await pick("project"), task: await pick("task"), client: await pick("client"), role: await pick("role") };
const routes = [
  "/", "/ops", "/ops/overview", "/ops/portfolio", "/ops/portfolio?month=all&sort=completion", "/ops/pipeline", "/ops/pipeline?month=all", "/ops/pipeline?month=all&overdue=1&sort=priority", "/ops/pipeline/export?month=all",
  "/ops/daily-desk", "/ops/delivery-canvas", "/ops/performance", "/ops/client-rpa",
  "/my-tasks", "/my-tasks?view=list", "/my-tasks?scope=org", "/my-tasks/new", "/my-tasks/complete", "/my-tasks/report",
  "/projects", "/projects?scope=all", "/projects?scope=all&q=a", "/projects/new",
  "/people", "/people?status=exited", "/people/new", `/people/${user.id}/edit`,
  "/departments", "/clients", "/settings", "/settings?role=new",
  ...(ids.role ? [`/settings?role=${ids.role}`] : []),
  ...(ids.client ? [`/clients?id=${ids.client}`] : []),
  ...(ids.project
    ? [
        `/projects/${ids.project}`, `/projects/${ids.project}/edit`, `/ops/pipeline?month=all&project=${ids.project}`, `/projects/${ids.project}?view=clients`,
        ...["tasks", "files", "members", "deliverables", "expenses", "notes", "discussion", "invoices"].map((t) => `/projects/${ids.project}?tab=${t}`),
      ]
    : []),
  ...(ids.task ? [`/my-tasks/${ids.task}`, `/my-tasks/${ids.task}/edit`, `/ops/pipeline?month=all&task=${ids.task}`, `/ops/pipeline?month=all&task=${ids.task}&block=1`] : []),
];
let bad = 0;
for (const r of routes) {
  const res = await fetch(`${base}${r}`, { headers: { cookie: `wh_session=${token}` }, redirect: "manual" });
  const body = res.headers.get("content-type")?.includes("html") ? await res.text() : "";
  const err = res.status === 200 && /Application error|Unhandled Runtime Error|__next_error__|Internal Server Error/.test(body);
  // "/" and "/ops" pick a first screen; "/projects" opens the first project in the list.
  const redirected = res.status >= 300 && res.status < 400 && (["/", "/ops"].includes(r) || r.startsWith("/projects?") || r === "/projects");
  if ((res.status !== 200 && !redirected) || err) { bad++; console.log("FAIL", res.status, r, res.headers.get("location") ?? "", err ? "(error page)" : ""); }
}
console.log(`${routes.length - bad}/${routes.length} routes OK for ${email}`);
await db.session.deleteMany({ where: { tokenHash } });
await db.$disconnect();
