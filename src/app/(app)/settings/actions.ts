"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/lib/auth";
import { db } from "@/lib/db";
import { formObject, fromZod, toActionError, type ActionState } from "@/lib/actions";
import { sanitizePermissions } from "@/lib/permissions";

const orgSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(2, "At least 2 characters").max(80),
  taskApprovalRequired: z.enum(["on"]).optional(),
  autoApproveTasks: z.enum(["on"]).optional(),
  autoApproveMaxHours: z.coerce.number({ invalid_type_error: "Enter hours" }).min(0, "0 or more").max(100, "At most 100"),
});

export async function saveOrgSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("settings.manage");
    const parsed = orgSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const data = {
      name: parsed.data.name,
      taskApprovalRequired: parsed.data.taskApprovalRequired === "on",
      autoApproveTasks: parsed.data.autoApproveTasks === "on",
      autoApproveMaxHours: parsed.data.autoApproveMaxHours,
    };
    await db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org", ...data }, update: data });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/", "layout");
  return {};
}

const roleSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(2, "At least 2 characters").max(60),
  description: z.string().max(200).optional(),
});

/** Create (no id) or update a role and its permissions. */
export async function saveRole(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("settings.manage");
    const parsed = roleSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const permissions = sanitizePermissions(formData.getAll("permissions").map(String));
    // Keep at least one way back into Settings: nobody may remove settings.manage from their own role.
    const own = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { roleId: true } });
    if (id === own.roleId && !permissions.includes("settings.manage")) throw new AuthorizationError("You cannot remove Settings access from your own role.");
    const data = { name: parsed.data.name, description: parsed.data.description ?? null, permissions };
    if (id) await db.role.update({ where: { id }, data });
    else await db.role.create({ data });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/settings");
  return {};
}

export async function deleteRole(formData: FormData) {
  await assertPermission("settings.manage");
  const id = String(formData.get("id"));
  const role = await db.role.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } });
  if (role.isSystem || role._count.users > 0) throw new AuthorizationError("Only unused custom roles can be deleted");
  await db.role.delete({ where: { id } });
  revalidatePath("/settings");
}
