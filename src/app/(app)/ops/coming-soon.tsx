import { Badge, Card, PageHeader } from "@/components/ui";

// Placeholder shown on each Ops Tracker screen until it is built (week numbers follow the Ops Tracker plan).
export function OpsComingSoon({ title, subtitle, week, items }: { title: string; subtitle: string; week: 1 | 2 | 3; items: string[] }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<Badge tone="brand">Planned · Week {week}</Badge>} />
      <Card title="What this screen will show">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
