import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-6xl">🧊</div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Looks like this page got scrambled
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        We couldn&apos;t find what you&apos;re looking for. Maybe it got DNF&apos;d.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
      >
        Back to home
      </Link>
    </main>
  );
}
