import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="mt-1 text-sm text-slate-500">Ask an administrator to update your role.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand-600 underline">
          Back to BuildAtScaleOS
        </Link>
      </div>
    </main>
  );
}
