// Project-local PostgreSQL cluster for development.
// Keeps data in ./.pgdata (git-ignored) and listens on 127.0.0.1:5434 only, so it runs alongside the
// OpsCentral platform's cluster (5433) and never touches a system-wide PostgreSQL install.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, ".pgdata");
const port = process.env.PGPORT_LOCAL ?? "5434";
const user = "opstracker";
const database = "opstracker";
const bin = (name) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name);

// The postgres server started by `pg_ctl start` inherits our stdio; on Windows an inherited pipe keeps the
// caller waiting until the server exits, so server starts run with stdio ignored (output goes to server.log).
function run(cmd, args, { allowFail = false, quiet = false } = {}) {
  const res = spawnSync(bin(cmd), args, { stdio: quiet ? "ignore" : "inherit", shell: false });
  if (res.error) {
    console.error(`Could not run ${cmd}: ${res.error.message}. Set PG_BIN to the PostgreSQL bin directory.`);
    process.exit(1);
  }
  if (res.status !== 0 && !allowFail) process.exit(res.status ?? 1);
  return res.status;
}

const pgCtl = (...args) =>
  run("pg_ctl", ["-D", dataDir, ...args], { allowFail: args[0] === "status", quiet: args.includes("start") });
const startArgs = () => ["-o", `-p ${port} -c listen_addresses=127.0.0.1`, "-l", path.join(dataDir, "server.log"), "-w", "start"];

switch (process.argv[2]) {
  case "init": {
    if (existsSync(path.join(dataDir, "PG_VERSION"))) {
      console.log("Cluster already initialised in .pgdata");
      break;
    }
    mkdirSync(dataDir, { recursive: true });
    run("initdb", ["-D", dataDir, "-U", user, "--auth=trust", "-E", "UTF8", "--no-locale"]);
    pgCtl(...startArgs());
    run("createdb", ["-h", "127.0.0.1", "-p", port, "-U", user, database]);
    console.log(`Created database ${database} on 127.0.0.1:${port}`);
    break;
  }
  case "start":
    pgCtl(...startArgs());
    console.log(`PostgreSQL running on 127.0.0.1:${port} (log: .pgdata/server.log)`);
    break;
  case "stop":
    pgCtl("-w", "stop");
    break;
  case "status":
    pgCtl("status");
    break;
  default:
    console.log("Usage: node scripts/db.mjs <init|start|stop|status>");
    process.exit(1);
}
