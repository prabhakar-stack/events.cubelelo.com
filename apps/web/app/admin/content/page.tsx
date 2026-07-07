"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import {
  fetchAdminContentPages,
  createContentPage,
  updateContentPage,
  deleteContentPage,
  type ContentPageDto,
} from "@/lib/api";

const PAGE_EMPTY = { slug: "", title: "", bodyMd: "", published: false };

export default function AdminContentPage() {
  const [pages, setPages] = useState<ContentPageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(PAGE_EMPTY);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminContentPages()
      .then((list) => {
        setPages(list);
        setActiveId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = pages.find((p) => p.id === activeId) ?? null;

  const selectTab = (id: string) => {
    if (creating) { setCreating(false); }
    setActiveId(id);
    const page = pages.find((p) => p.id === id);
    if (page) {
      setForm({ slug: page.slug, title: page.title, bodyMd: page.bodyMd, published: page.published });
      setDirty(false);
      setPreview(false);
      setError(null);
    }
  };

  useEffect(() => {
    if (active && !creating) {
      setForm({ slug: active.slug, title: active.title, bodyMd: active.bodyMd, published: active.published });
      setDirty(false);
      setPreview(false);
    }
  }, [activeId]);

  const startCreate = () => {
    setCreating(true);
    setForm(PAGE_EMPTY);
    setDirty(false);
    setPreview(false);
    setError(null);
  };

  const updateForm = (patch: Partial<typeof PAGE_EMPTY>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    if (!form.slug.trim() || !form.title.trim()) {
      setError("Slug and title are required.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      if (creating) {
        const created = await createContentPage(form);
        setCreating(false);
        setActiveId(created.id);
      } else if (active) {
        await updateContentPage(active.id, { title: form.title, bodyMd: form.bodyMd, published: form.published });
      }
      setDirty(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const togglePublish = async () => {
    if (!active) return;
    setBusy("publish");
    try {
      await updateContentPage(active.id, { published: !active.published });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    if (!active || !confirm(`Delete page "${active.title}"?`)) return;
    setBusy("del");
    try {
      await deleteContentPage(active.id);
      setActiveId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-8 py-10">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Content</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage footer pages. Select a tab to edit its content.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => selectTab(p.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
              !creating && activeId === p.id
                ? "border-b-2 border-emerald-500 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {p.title}
            {!p.published && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" title="Draft" />
            )}
          </button>
        ))}
        <button
          onClick={startCreate}
          className={`px-4 py-2.5 text-sm font-medium transition ${
            creating
              ? "border-b-2 border-emerald-500 text-emerald-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          + New
        </button>
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {/* Editor */}
      {(creating || active) && (
        <div className="space-y-4">
          {/* Slug + Title row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Slug (URL path)</label>
              <input
                value={form.slug}
                onChange={(e) => updateForm({ slug: e.target.value })}
                placeholder="about-us"
                disabled={!creating}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Title</label>
              <input
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder="About Us"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-zinc-500">Body (Markdown)</label>
              <button
                onClick={() => setPreview((p) => !p)}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
            {preview ? (
              <div className="min-h-[300px] rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                {form.bodyMd ? <Markdown>{form.bodyMd}</Markdown> : <p className="text-sm text-zinc-400">(empty)</p>}
              </div>
            ) : (
              <textarea
                value={form.bodyMd}
                onChange={(e) => updateForm({ bodyMd: e.target.value })}
                rows={16}
                placeholder="Write page content in Markdown..."
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            )}
          </div>

          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button
              onClick={save}
              disabled={busy === "save" || (!creating && !dirty)}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "save" ? "Saving..." : creating ? "Create Page" : "Save Changes"}
            </button>

            {!creating && active && (
              <>
                <button
                  onClick={togglePublish}
                  disabled={busy === "publish"}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-40"
                >
                  {active.published ? "Unpublish" : "Publish"}
                </button>
                <div className="flex-1" />
                <span className="text-xs text-zinc-500">
                  /{active.slug} &middot; Updated {new Date(active.updatedAt).toLocaleDateString()}
                  {active.published ? " · Published" : " · Draft"}
                </span>
                <button
                  onClick={del}
                  disabled={busy === "del"}
                  className="rounded-lg border border-red-900/40 px-3 py-2 text-xs text-red-500 hover:bg-red-950/30 disabled:opacity-40"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!creating && !active && pages.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
          No pages yet. Click "+ New" to create your first footer page.
        </div>
      )}
    </div>
  );
}
