import { redirect } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";

// The Ops Tracker menu item opens the Overview for ops.manage holders, otherwise the Task Pipeline (plan v2: employees mostly use it).
export default async function OpsTrackerPage() {
  const user = await requirePermission("ops.view");
  redirect(can(user, "ops.manage") ? "/ops/overview" : "/ops/pipeline");
}
