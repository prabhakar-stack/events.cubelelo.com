"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminContentPages,
  createContentPage,
  updateContentPage,
  deleteContentPage,
  type ContentPageDto,
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
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Migration", href: "/admin/migration" },
  { label: "Content", href: "/admin/content" },
  { label: "Details", href: "/admin/faq" },
  { label: "Pages", href: "/admin/pages" },
  { label: "Staff", href: "/admin/staff" },
];

const EMPTY = { slug: "", title: "", bodyMd: "", published: false };

export default function AdminPagesPage() {
  const [list, setList] = useState<ContentPageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentPageDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminContentPages()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setCreating(true); setPreview(false); };
  const openEdit = (p: ContentPageDto) => {
    setForm({ slug: p.slug, title: p.title, bodyMd: p.bodyMd, published: p.published });
    setEditing(p);
    setCreating(false);
    setPreview(false);
  };
  const closeForm = () => { setCreating(false); setEditing(null); setError(null); setPreview(false); };

  const save = async () => {
    if (!form.slug.trim() || !form.title.trim()) {
      setError("Slug and title are required.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      if (editing) {
        await updateContentPage(editing.id, form);
      } else {
        await createContentPage(form);
      }
      closeForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const togglePublish = async (p: ContentPageDto) => {
    setBusy(p.id);
    try { await updateContentPage(p.id, { published: !p.published }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const del = async (p: ContentPageDto) => {
    if (!confirm(`Delete page "${p.title}"?`)) return;
    setBusy(`del-${p.id}`);
    try { await deleteContentPage(p.id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 ${
              tab.href === "/admin/pages" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Footer Pages</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage configurable pages (About Us, Rules, FAQs, Privacy Policy, Contact Us). Content is Markdown.</p>
        </div>
        {!creating && !editing && (
          <button onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            + New Page
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {(creating || editing) && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {editing ? "Edit Page" : "New Page"}
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Slug (URL path)</label>
                <input value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="about-us"
                  disabled={!!editing}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Title</label>
                <input value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="About Us"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-zinc-500">Body (Markdown)</label>
                <button onClick={() => setPreview((p) => !p)}
                  className="text-xs text-emerald-400 hover:text-emerald-300">
                  {preview ? "Edit" : "Preview"}
                </button>
              </div>
              {preview ? (
                <div className="min-h-[150px] rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 whitespace-pre-wrap">
                  {form.bodyMd}
                </div>
              ) : (
                <textarea value={form.bodyMd}
                  onChange={(e) => setForm((f) => ({ ...f, bodyMd: e.target.value }))}
                  rows={10}
                  placeholder="Write page content in Markdown..."
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={form.published}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                className="accent-emerald-500" />
              Published
            </label>
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
          No pages yet. Create one or run the migration to seed defaults.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <div key={p.id} className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {p.published ? (
                    <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Published</span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Draft</span>
                  )}
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">/{p.slug}</span>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{p.title}</h3>
                </div>
                <span className="text-xs text-zinc-600">
                  Updated {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mb-3 line-clamp-2 text-xs text-zinc-400">{p.bodyMd || "(empty)"}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(p)}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                  Edit
                </button>
                <button onClick={() => togglePublish(p)} disabled={busy === p.id}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40">
                  {p.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => del(p)} disabled={busy === `del-${p.id}`}
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
