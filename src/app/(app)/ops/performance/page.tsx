import { requirePermission } from "@/lib/auth";
import { OpsComingSoon } from "../coming-soon";

// Everyone with ops.view sees their own scorecard; ops.performance will unlock the whole team.
export default async function OpsPerformancePage() {
  await requirePermission("ops.view");
  return (
    <OpsComingSoon
      title="Performance"
      subtitle="Data-driven scorecards from actual delivery"
      week={3}
      items={[
        "Per employee: assigned, completed, overdue, active WIP, average turnaround",
        "On-time delivery %, first-pass quality % and balanced appraisal score",
        "Performance tier and 3-month trajectory (Ascending, Stable, Declining)",
      ]}
    />
  );
}
