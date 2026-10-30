"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formObject, fromZod, toActionError, type ActionState } from "@/lib/actions";

const clientSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(2, "At least 2 characters").max(120),
  contactName: z.string().max(120).optional(),
  email: z.string().email("Enter a valid email").optional(),
  phone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

/** Create (no id) or update a client. */
export async function saveClient(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("clients.manage");
    const parsed = clientSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const data = { contactName: null, email: null, phone: null, notes: null, ...parsed.data };
    if (id) await db.client.update({ where: { id }, data });
    else await db.client.create({ data });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath("/clients");
  redirect("/clients");
}

export async function deleteClient(formData: FormData) {
  await assertPermission("clients.manage");
  const id = String(formData.get("id"));
  // Projects keep their client, so a client with projects cannot be deleted.
  if ((await db.project.count({ where: { clientId: id } })) > 0) redirect(`/clients?error=has-projects`);
  await db.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}
