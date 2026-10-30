// Creates (or resets) a Management login without touching other data. Use it for the owner's first account.
// Usage: NEW_EMAIL=.. NEW_PASSWORD=.. [NEW_NAME=..] node scripts/dev/create-user.cjs "$PWD"
// Existing user with that email: password reset, role set to Management, status ACTIVE.
const { createRequire } = require("node:module");
const req = createRequire(process.argv[2] + "/package.json");
const { PrismaClient } = req("@prisma/client");
const bcrypt = req("bcryptjs");
(async () => {
  const db = new PrismaClient();
  const email = process.env.NEW_EMAIL.toLowerCase();
  const role = await db.role.findUniqueOrThrow({ where: { name: "Management" } });
  const passwordHash = await bcrypt.hash(process.env.NEW_PASSWORD, 10);
  const u = await db.user.upsert({
    where: { email },
    update: { passwordHash, roleId: role.id, status: "ACTIVE" },
    create: { email, passwordHash, name: process.env.NEW_NAME ?? email, roleId: role.id },
  });
  const ok = await bcrypt.compare(process.env.NEW_PASSWORD, (await db.user.findUnique({ where: { id: u.id } })).passwordHash);
  console.log("user", u.email, "role", role.name, "status", u.status, "password verifies:", ok);
  await db.$disconnect();
})();
