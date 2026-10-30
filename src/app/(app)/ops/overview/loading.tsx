// Skeleton shown while the Overview's figures load.
const block = "animate-pulse rounded-2xl border border-cream-200 bg-white shadow-sm";

export default function OverviewLoading() {
  return (
    <div aria-busy="true" aria-label="Loading the Overview">
      <div className="mb-5 h-12 w-72 animate-pulse rounded-lg bg-cream-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-32`} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${block} h-44`} />
        ))}
      </div>
      <div className={`${block} mt-6 h-80`} />
    </div>
  );
}
