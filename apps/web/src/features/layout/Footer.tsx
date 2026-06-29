import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white py-8 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
      <p>© {new Date().getFullYear()} Cubelelo Events. All rights reserved.</p>
      <div className="mt-3 flex justify-center gap-6">
        <Link href="/competitions" className="transition hover:text-zinc-900 dark:hover:text-zinc-300">
          Competitions
        </Link>
        <Link href="/rankings" className="transition hover:text-zinc-900 dark:hover:text-zinc-300">
          Rankings
        </Link>
        <Link href="/practice" className="transition hover:text-zinc-900 dark:hover:text-zinc-300">
          Practice
        </Link>
      </div>
    </footer>
  );
}
