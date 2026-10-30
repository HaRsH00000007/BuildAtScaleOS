"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { formObject, fromZod, toActionError, type ActionState } from "@/lib/actions";

const personSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(2, "At least 2 characters").max(120),
  email: z.string({ required_error: "Email is required" }).email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(200).optional(),
  empCode: z.string().max(30).optional(),
  designation: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  joinDate: z.coerce.date().optional(),
  roleId: z.string({ required_error: "Choose a role" }),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  status: z.enum(["ACTIVE", "EXITED"]).default("ACTIVE"),
});

function personData(p: z.infer<typeof personSchema>) {
  return {
    name: p.name,
    email: p.email.toLowerCase(),
    empCode: p.empCode ?? null,
    designation: p.designation ?? null,
    phone: p.phone ?? null,
    joinDate: p.joinDate ?? null,
    roleId: p.roleId,
    departmentId: p.departmentId ?? null,
    managerId: p.managerId ?? null,
  };
}

export async function createPerson(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("people.manage");
    const parsed = personSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    if (!parsed.data.password) return { error: "Please fix the highlighted fields.", fieldErrors: { password: ["Set a first password"] } };
    await db.user.create({ data: { ...personData(parsed.data), passwordHash: await hashPassword(parsed.data.password) } });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/people");
  redirect("/people");
}

export async function updatePerson(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("people.manage");
    const parsed = personSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    if (id === user.id && parsed.data.status !== "ACTIVE") return { error: "You cannot deactivate your own account." };
    if (parsed.data.managerId === id) return { error: "Please fix the highlighted fields.", fieldErrors: { managerId: ["A person cannot report to themselves"] } };
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { ...personData(parsed.data), status: parsed.data.status, ...(parsed.data.password ? { passwordHash: await hashPassword(parsed.data.password) } : {}) },
      });
      // Deactivated people and password resets are signed out everywhere.
      if (parsed.data.status !== "ACTIVE" || parsed.data.password) await tx.session.deleteMany({ where: { userId: id } });
    });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/people");
  redirect("/people");
}
