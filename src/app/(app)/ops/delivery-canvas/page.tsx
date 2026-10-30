import { requirePermission } from "@/lib/auth";
import { OpsComingSoon } from "../coming-soon";

export default async function OpsDeliveryCanvasPage() {
  await requirePermission("ops.view");
  return (
    <OpsComingSoon
      title="Delivery Canvas"
      subtitle="Visual Kanban and delivery analytics"
      week={2}
      items={[
        "KPI cards: total, completed, in progress, under review, overdue SLA, active blockers",
        "Kanban board with drag-and-drop status changes",
        "Workload by teammate, SLA health donut and blockers-by-cause charts",
      ]}
    />
  );
}
