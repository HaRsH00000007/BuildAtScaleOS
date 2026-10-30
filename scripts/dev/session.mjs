// Creates (or revokes) a short-lived local session for an existing user, for local checks.
// usage: node session.mjs create <email> <projectDir>   → prints the cookie value
//        node session.mjs revoke <token> <projectDir>
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
const [mode, arg, dir] = process.argv.slice(2);
const require = createRequire(dir + "/package.json");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const hash = (t) => createHash("sha256").update(t).digest("hex");
if (mode === "create") {
  const user = await db.user.findUniqueOrThrow({ where: { email: arg } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + 2 * 3600000) } });
  console.log(token);
} else {
  await db.session.deleteMany({ where: { tokenHash: hash(arg) } });
  console.log("revoked");
}
await db.$disconnect();
