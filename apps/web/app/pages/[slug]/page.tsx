"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPublicPage } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

export default function ContentPage({
  params,
}: {
  params: { slug: string };
}) {
  const [page, setPage] = useState<{ title: string; bodyMd: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchPublicPage(params.slug)
      .then(setPage)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  if (notFound || !page) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-zinc-500">Page not found</p>
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        &larr; Home
      </Link>
      <h1 className="mb-6 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{page.title}</h1>
      <Markdown>{page.bodyMd}</Markdown>
    </main>
  );
}
