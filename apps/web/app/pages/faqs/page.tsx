"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPublicFaq, type FaqDto } from "@/lib/api";

export default function FaqPage() {
  const [faqs, setFaqs] = useState<FaqDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicFaq()
      .then(setFaqs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        &larr; Home
      </Link>
      <h1 className="mb-6 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Frequently Asked Questions
      </h1>

      {faqs.length === 0 ? (
        <p className="text-sm text-zinc-500">No FAQs published yet.</p>
      ) : (
        <div className="space-y-2">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <button
                onClick={() => setOpen(open === faq.id ? null : faq.id)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {faq.question}
                </span>
                <span className="ml-3 shrink-0 text-zinc-400">
                  {open === faq.id ? "−" : "+"}
                </span>
              </button>
              {open === faq.id && (
                <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {faq.answerMd}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
