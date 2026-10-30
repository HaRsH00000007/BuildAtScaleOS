"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// Departments are teams ("My Team" on My Tasks); task types are the department's kinds of work.
const NAME_MAX = 80;

function readName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= NAME_MAX ? name : null;
}

async function save(write: () => Promise<unknown>) {
  try {
    await write();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") redirect("/departments?error=duplicate");
    throw err;
  }
  revalidatePath("/departments");
}

export async function addDepartment(formData: FormData) {
  await assertPermission("people.manage");
  const name = readName(formData);
  if (!name) redirect("/departments?error=name");
  await save(() => db.department.create({ data: { name } }));
}

export async function deleteDepartment(formData: FormData) {
  await assertPermission("people.manage");
  // Members keep working without a department; the department's task types are removed from tasks.
  await save(() => db.department.delete({ where: { id: String(formData.get("id")) } }));
}

export async function addTaskType(formData: FormData) {
  await assertPermission("people.manage");
  const name = readName(formData);
  if (!name) redirect("/departments?error=name");
  await save(() => db.taskType.create({ data: { name, departmentId: String(formData.get("departmentId")) } }));
}

export async function deleteTaskType(formData: FormData) {
  await assertPermission("people.manage");
  await save(() => db.taskType.delete({ where: { id: String(formData.get("id")) } }));
}
