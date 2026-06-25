import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">🧊 Cubelelo Events</h1>
        <p className="text-zinc-400">
          Competition platform — Phase 1 build in progress.
        </p>
      </div>

      <Link
        href="/competitions/demo/round/1"
        className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
      >
        Open Competition Terminal (3×3) →
      </Link>

      <p className="max-w-md text-sm text-zinc-500">
        The terminal runs the WCA timer engine in a Web Worker with mandatory
        inspection, and renders the scramble with a 2D cube visualizer.
      </p>
    </main>
  );
}
