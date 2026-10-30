import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black p-4">
      <div className="text-center">
        <p className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Build Strong <span className="mx-2 text-zinc-600">|</span> Scale Fast
        </p>
        <p className="mt-3 text-zinc-300">
          Projects, tasks and <span className="text-accent">delivery</span> in one place.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-3xl bg-cream p-6 shadow-xl">
        <div className="mb-6">
          <Wordmark tone="light" className="text-2xl" />
          <h1 className="mt-3 text-xl font-semibold text-ink">Sign in</h1>
          <p className="text-sm text-slate-500">Use your work email.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
