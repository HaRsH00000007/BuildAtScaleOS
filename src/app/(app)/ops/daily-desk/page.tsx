import { requirePermission } from "@/lib/auth";
import { OpsComingSoon } from "../coming-soon";

export default async function OpsDailyDeskPage() {
  await requirePermission("ops.view");
  return (
    <OpsComingSoon
      title="Daily Desk"
      subtitle="Run the morning standup in under 15 minutes"
      week={2}
      items={[
        "Today's priority queue: due today or earlier, urgent, or blocked",
        "SOP checkpoints (09:30 standup, 13:00 queue check, 17:30 EOD handover) with owners",
        "Tick-off log so missed gates are visible",
      ]}
    />
  );
}
