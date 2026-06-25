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

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/competitions/demo/lobby"
          className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-100 transition hover:bg-zinc-900"
        >
          Competition Lobby →
        </Link>
        <Link
          href="/competitions/demo/round/1"
          className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
        >
          Open Competition Terminal (3×3) →
        </Link>
      </div>

      <p className="max-w-md text-sm text-zinc-500">
        The lobby shows a live roster + countdown; the terminal runs the WCA
        timer engine in a Web Worker with a 2D cube visualizer.
      </p>

      <Link href="/admin" className="text-sm text-zinc-500 underline hover:text-zinc-300">
        Admin panel
      </Link>
    </main>
  );
}
