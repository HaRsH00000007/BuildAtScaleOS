"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission, AuthorizationError, can, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formObject, fromZod, toActionError, type ActionState } from "@/lib/actions";
import { parseAmount } from "@/lib/finance";
import { canManageProject } from "@/lib/projects";

// Project type, value, other income and expenses came back from the platform for the Harmony-style workspace
// (2026-10-29). Contract approval, allocations, invoices and cost rates are still not part of BuildAtScaleOS.

const amount = (label: string) =>
  z
    .string()
    .optional()
    .transform((s) => parseAmount(s))
    .refine((n) => !Number.isNaN(n), { message: `Enter ${label} in rupees, e.g. 80000` });
const flag = z
  .string()
  .optional()
  .transform((s) => s === "true" || s === "on");
const billingType = z.enum(["RETAINER", "PROJECT", "PAY_AS_YOU_GO"], { errorMap: () => ({ message: "Select a project type" }) });

const projectSchema = z
  .object({
    name: z.string({ required_error: "Name is required" }).min(2, "At least 2 characters").max(120),
    code: z.string().max(30).optional(),
    clientId: z.string({ required_error: "Choose a client" }).min(1, "Choose a client"),
    startDate: z.coerce.date({ errorMap: () => ({ message: "Enter a start date" }) }),
    endDate: z.coerce.date().optional(),
    status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
    description: z.string().max(2000).optional(),
    billingType,
    isBillable: flag,
    isPublic: flag,
    value: amount("the project value"),
  })
  .refine((p) => !p.endDate || p.endDate >= p.startDate, { path: ["endDate"], message: "Target due date must be after the start date" });

// The Add New Project wizard (Harmony): Basic Details → Project Value → Department & Members. Harmony requires the
// end date and project value on create (V, screenshots); editing keeps them optional for older projects.
const wizardSchema = z
  .object({
    name: z.string({ required_error: "Project name is required" }).min(2, "At least 2 characters").max(120),
    clientId: z.string({ required_error: "Select a client" }).min(1, "Select a client"),
    billingType,
    isBillable: flag,
    isPublic: flag,
    startDate: z.coerce.date({ errorMap: () => ({ message: "Enter the project start date" }) }),
    endDate: z.coerce.date({ errorMap: () => ({ message: "Enter the project end date" }) }),
    value: z
      .string({ required_error: "Enter the project value" })
      .transform((s) => parseAmount(s))
      .refine((n) => !Number.isNaN(n), { message: "Enter the project value in rupees, e.g. 80000" }),
    otherIncome: amount("the additional income"),
    directExpenses: amount("the direct expenses"),
  })
  .refine((p) => p.endDate >= p.startDate, { path: ["endDate"], message: "End date must be on or after the start date" });

function revalidateProjects() {
  revalidatePath("/projects", "layout");
  revalidatePath("/ops/portfolio");
  revalidatePath("/ops/pipeline");
}

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await assertPermission("projects.manage");
    const parsed = wizardSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const { otherIncome, directExpenses, ...data } = parsed.data;

    // Only active people can be added. The creator stays a manager unless they can see every project anyway and
    // picked other managers, so nobody creates a project they then cannot open or edit.
    const ids = (key: string) => [...new Set(formData.getAll(key).map(String).filter(Boolean))];
    const active = new Set(
      (await db.user.findMany({ where: { id: { in: [...ids("managerIds"), ...ids("memberIds")] }, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id),
    );
    const managers = ids("managerIds").filter((m) => active.has(m));
    if (managers.length === 0 || !can(user, "projects.view_all")) managers.push(user.id);
    const managerSet = new Set(managers);
    const members = ids("memberIds").filter((m) => active.has(m) && !managerSet.has(m));

    const note = "Entered when the project was created";
    const project = await db.project.create({
      data: {
        ...data,
        members: {
          create: [...[...managerSet].map((userId) => ({ userId, role: "MANAGER" as const })), ...members.map((userId) => ({ userId, role: "MEMBER" as const }))],
        },
        financeEntries: {
          create: [
            ...(otherIncome > 0 ? [{ kind: "OTHER_INCOME" as const, amount: otherIncome, description: `Additional income. ${note}` }] : []),
            ...(directExpenses > 0 ? [{ kind: "DIRECT_EXPENSE" as const, amount: directExpenses, description: `Direct expenses. ${note}` }] : []),
          ].map((e) => ({ ...e, date: data.startDate, createdById: user.id })),
        },
      },
    });
    id = project.id;
  } catch (err) {
    return toActionError(err);
  }
  revalidateProjects();
  redirect(`/projects/${id}`);
}

export async function updateProject(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !(await canManageProject(user, id))) throw new AuthorizationError("You cannot edit this project");
    const parsed = projectSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.project.update({
      where: { id },
      data: { ...parsed.data, code: parsed.data.code ?? null, endDate: parsed.data.endDate ?? null, description: parsed.data.description ?? null },
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidateProjects();
  redirect(`/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await getCurrentUser();
  if (!user || !(await canManageProject(user, id))) throw new AuthorizationError("You cannot delete this project");
  await db.project.delete({ where: { id } });
  revalidateProjects();
  redirect("/projects");
}

// ---------- Add Client (from the wizard) ----------

// Harmony's inline Add Client dialog: Client Name*, Description, Client Email, Phone Number (V, screenshot).
// Description is stored as the client's notes.
const inlineClientSchema = z.object({
  name: z.string({ required_error: "Client name is required" }).min(2, "At least 2 characters").max(120),
  notes: z.string().max(2000).optional(),
  email: z.string().email("Enter a valid email").optional(),
  phone: z.string().max(30).optional(),
});

export type InlineClientState = ActionState & { client?: { id: string; name: string } };

export async function createClientInline(_: InlineClientState, formData: FormData): Promise<InlineClientState> {
  try {
    await assertPermission("clients.manage");
    const parsed = inlineClientSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const client = await db.client.create({ data: { name: parsed.data.name, notes: parsed.data.notes ?? null, email: parsed.data.email ?? null, phone: parsed.data.phone ?? null } });
    revalidatePath("/clients");
    return { client: { id: client.id, name: client.name } };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------- Members ----------

export async function addMember(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const userId = String(formData.get("userId"));
  const role = formData.get("role") === "MANAGER" ? "MANAGER" : "MEMBER";
  const user = await getCurrentUser();
  if (!user || !(await canManageProject(user, projectId))) throw new AuthorizationError("You cannot change members");
  await db.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  });
  revalidateProjects();
}

export async function removeMember(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const userId = String(formData.get("userId"));
  const user = await getCurrentUser();
  if (!user || !(await canManageProject(user, projectId))) throw new AuthorizationError("You cannot change members");
  const managers = await db.projectMember.count({ where: { projectId, role: "MANAGER" } });
  const target = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (target?.role === "MANAGER" && managers <= 1) throw new AuthorizationError("A project needs at least one manager");
  await db.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  revalidateProjects();
}

// ---------- Expenses tab (other income and expenses) ----------

const financeSchema = z.object({
  kind: z.enum(["OTHER_INCOME", "DIRECT_EXPENSE", "ADHOC_EXPENSE"]),
  date: z.coerce.date({ errorMap: () => ({ message: "Enter a date" }) }),
  description: z.string({ required_error: "Describe the entry" }).min(2, "At least 2 characters").max(200),
  amount: z
    .string({ required_error: "Enter an amount" })
    .transform((s) => parseAmount(s))
    .refine((n) => !Number.isNaN(n) && n > 0, { message: "Enter an amount above ₹0" }),
});

export async function addFinanceEntry(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !(await canManageProject(user, projectId))) throw new AuthorizationError("Only project managers can record income and expenses");
    const parsed = financeSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.projectFinanceEntry.create({ data: { ...parsed.data, projectId, createdById: user.id } });
  } catch (err) {
    return toActionError(err);
  }
  revalidateProjects();
  return {};
}

export async function deleteFinanceEntry(formData: FormData) {
  const entry = await db.projectFinanceEntry.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  const user = await getCurrentUser();
  if (!user || !(await canManageProject(user, entry.projectId))) throw new AuthorizationError("Only project managers can remove entries");
  await db.projectFinanceEntry.delete({ where: { id: entry.id } });
  revalidateProjects();
}
