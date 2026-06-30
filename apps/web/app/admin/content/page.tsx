"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  type BannerDto,
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

const EMPTY = { title: "", imageUrl: "", ctaText: "", ctaLink: "", expiresAt: "", active: true, order: 0 };

export default function AdminContentPage() {
  const [list, setList] = useState<BannerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BannerDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminBanners()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setCreating(true); };
  const openEdit = (b: BannerDto) => {
    setForm({
      title: b.title,
      imageUrl: b.imageUrl ?? "",
      ctaText: b.ctaText ?? "",
      ctaLink: b.ctaLink ?? "",
      expiresAt: b.expiresAt ?? "",
      active: b.active,
      order: b.order,
    });
    setEditing(b);
    setCreating(false);
  };
  const closeForm = () => { setCreating(false); setEditing(null); setError(null); };

  const save = async () => {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setBusy("save");
    setError(null);
    try {
      const payload = {
        title: form.title,
        imageUrl: form.imageUrl || undefined,
        ctaText: form.ctaText || undefined,
        ctaLink: form.ctaLink || undefined,
        expiresAt: form.expiresAt || undefined,
        active: form.active,
        order: form.order,
      };
      if (editing) {
        await updateBanner(editing.id, payload);
      } else {
        await createBanner(payload);
      }
      closeForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (b: BannerDto) => {
    setBusy(b.id);
    try { await updateBanner(b.id, { active: !b.active }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const del = async (b: BannerDto) => {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    setBusy(`del-${b.id}`);
    try { await deleteBanner(b.id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 ${
              tab.href === "/admin/content" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Banner Management</h1>
          <p className="mt-1 text-sm text-zinc-500">Hero banners shown on the homepage. Set CTA links, expiry dates, and display order.</p>
        </div>
        {!creating && !editing && (
          <button onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            + New Banner
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded bg-red-100 px-4 py-2 text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      {(creating || editing) && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {editing ? "Edit Banner" : "New Banner"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Title</label>
              <input value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Banner title"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Image URL</label>
              <input value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://example.com/hero.jpg"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">CTA Text</label>
                <input value={form.ctaText}
                  onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
                  placeholder="Learn More"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">CTA Link</label>
                <input value={form.ctaLink}
                  onChange={(e) => setForm((f) => ({ ...f, ctaLink: e.target.value }))}
                  placeholder="/competitions/abc"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Expires At</label>
                <input type="datetime-local" value={form.expiresAt ? form.expiresAt.slice(0, 16) : ""}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Display Order</label>
                <input type="number" value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="accent-emerald-500" />
              Active
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
          No banners yet. Create one to display on the homepage.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <div key={b.id} className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {b.active ? (
                    <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Active</span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Inactive</span>
                  )}
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">#{b.order}</span>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{b.title}</h3>
                </div>
                <span className="text-xs text-zinc-600">
                  {b.expiresAt ? `Expires ${new Date(b.expiresAt).toLocaleDateString()}` : "No expiry"}
                </span>
              </div>
              {b.imageUrl && <p className="mb-2 truncate text-xs text-zinc-500">Image: {b.imageUrl}</p>}
              {b.ctaText && (
                <p className="mb-3 text-xs text-zinc-400">
                  CTA: <span className="text-zinc-700 dark:text-zinc-300">{b.ctaText}</span>
                  {b.ctaLink && <span className="text-zinc-500"> → {b.ctaLink}</span>}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(b)}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                  Edit
                </button>
                <button onClick={() => toggleActive(b)} disabled={busy === b.id}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40">
                  {b.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => del(b)} disabled={busy === `del-${b.id}`}
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
