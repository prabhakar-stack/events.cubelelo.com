"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminFaq,
  createFaq,
  updateFaq,
  deleteFaq,
  type FaqDto,
} from "@/lib/api";

const TABS = [
  { label: "Competitions", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Promo Codes", href: "/admin/promo-codes" },
  { label: "Appeals", href: "/admin/appeals" },
  { label: "WCA Queue", href: "/admin/wca-queue" },
  { label: "Rank Tiers", href: "/admin/rank-tiers" },
  { label: "Merge", href: "/admin/merge" },
  { label: "CMS", href: "/admin/cms" },
  { label: "Migration", href: "/admin/migration" },
  { label: "Content", href: "/admin/content" },
  { label: "Details", href: "/admin/faq" },
  { label: "Staff", href: "/admin/staff" },
];

const EMPTY = { question: "", answerMd: "", order: 0, published: false };

export default function AdminFaqPage() {
  const [list, setList] = useState<FaqDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FaqDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminFaq()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setCreating(true); setPreview(false); };
  const openEdit = (f: FaqDto) => {
    setForm({ question: f.question, answerMd: f.answerMd, order: f.order, published: f.published });
    setEditing(f);
    setCreating(false);
    setPreview(false);
  };
  const closeForm = () => { setCreating(false); setEditing(null); setError(null); setPreview(false); };

  const save = async () => {
    if (!form.question.trim() || !form.answerMd.trim()) {
      setError("Question and answer are required.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      if (editing) {
        await updateFaq(editing.id, form);
      } else {
        await createFaq(form);
      }
      closeForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const togglePublish = async (f: FaqDto) => {
    setBusy(f.id);
    try { await updateFaq(f.id, { published: !f.published }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const del = async (f: FaqDto) => {
    if (!confirm(`Delete FAQ "${f.question}"?`)) return;
    setBusy(`del-${f.id}`);
    try { await deleteFaq(f.id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 ${
              tab.href === "/admin/faq" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Details Editor</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage detail entries (FAQ, info snippets). Supports Markdown for answers.</p>
        </div>
        {!creating && !editing && (
          <button onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            + New FAQ
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {(creating || editing) && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {editing ? "Edit FAQ Entry" : "New FAQ Entry"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Question</label>
              <input value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="How do I register for a competition?"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-zinc-500">Answer (Markdown)</label>
                <button onClick={() => setPreview((p) => !p)}
                  className="text-xs text-emerald-400 hover:text-emerald-300">
                  {preview ? "Edit" : "Preview"}
                </button>
              </div>
              {preview ? (
                <div className="min-h-[150px] rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 whitespace-pre-wrap">
                  {form.answerMd}
                </div>
              ) : (
                <textarea value={form.answerMd}
                  onChange={(e) => setForm((f) => ({ ...f, answerMd: e.target.value }))}
                  rows={6}
                  placeholder="Write answer in Markdown..."
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Display Order</label>
                <input type="number" value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none" />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={form.published}
                    onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                    className="accent-emerald-500" />
                  Publish immediately
                </label>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={busy === "save"}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                {busy === "save" ? "Saving..." : editing ? "Save Changes" : "Create"}
              </button>
              <button onClick={closeForm}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-10 text-center text-zinc-500">
          No FAQ entries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((f) => (
            <div key={f.id} className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {f.published ? (
                    <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Published</span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Draft</span>
                  )}
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">#{f.order}</span>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{f.question}</h3>
                </div>
              </div>
              <p className="mb-3 line-clamp-2 text-xs text-zinc-400">{f.answerMd}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(f)}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                  Edit
                </button>
                <button onClick={() => togglePublish(f)} disabled={busy === f.id}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40">
                  {f.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => del(f)} disabled={busy === `del-${f.id}`}
                  className="rounded border border-red-900/40 px-3 py-1 text-xs text-red-500 hover:bg-red-950/30 disabled:opacity-40">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
