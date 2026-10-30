import { requirePermission } from "@/lib/auth";
import { OpsComingSoon } from "../coming-soon";

export default async function OpsClientRpaPage() {
  await requirePermission("ops.rpa");
  return (
    <OpsComingSoon
      title="Client RPA"
      subtitle="Weekly Review, Preview, Action report for each client"
      week={3}
      items={[
        "Review: deliverables completed this week with SLA status and revisions",
        "Preview: commitments for next week with due dates and priority",
        "Action: what the client must provide to unblock the team",
        "Save and export to PDF",
      ]}
    />
  );
}
