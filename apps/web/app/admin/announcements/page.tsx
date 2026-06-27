"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AnnouncementDto,
} from "@/lib/api";

const TABS = [
  { label: "Competitions", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Migration", href: "/admin/migration" },
];

const EMPTY = { title: "", bodyMd: "", pinned: false, published: false };

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AnnouncementDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminAnnouncements()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setCreating(true); };
  const openEdit = (a: AnnouncementDto) => { setForm({ title: a.title, bodyMd: a.bodyMd, pinned: a.pinned, published: a.published }); setEditing(a); setCreating(false); };
  const closeForm = () => { setCreating(false); setEditing(null); setError(null); };

  const save = async () => {
    if (!form.title.trim() || !form.bodyMd.trim()) {
      setError("Title and body are required.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, form);
      } else {
        await createAnnouncement(form);
      }
      closeForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const togglePublish = async (a: AnnouncementDto) => {
    setBusy(a.id);
    try { await updateAnnouncement(a.id, { published: !a.published }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const togglePin = async (a: AnnouncementDto) => {
    setBusy(`pin-${a.id}`);
    try { await updateAnnouncement(a.id, { pinned: !a.pinned }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const del = async (a: AnnouncementDto) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    setBusy(`del-${a.id}`);
    try { await deleteAnnouncement(a.id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Sub-nav */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
        {TABS.map((tab) => (
          <Link key={tab.label} href={tab.href}
            className={`rounded-md px-4 py-2 text-xs font-medium transition hover:bg-zinc-800/50 hover:text-zinc-200 ${
              tab.href === "/admin/announcements" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">Announcements</h1>
        {!creating && !editing && (
          <button onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            + New
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {/* Create / Edit form */}
      {(creating || editing) && (
        <div className="mb-6 rounded-xl border border-zinc-700 bg-zinc-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            {editing ? "Edit announcement" : "New announcement"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Body (Markdown)</label>
              <textarea
                value={form.bodyMd}
                onChange={(e) => setForm((f) => ({ ...f, bodyMd: e.target.value }))}
                rows={6}
                placeholder="Write announcement content in Markdown…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                  className="accent-emerald-500" />
                Pin to top
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={form.published}
                  onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                  className="accent-emerald-500" />
                Publish immediately
              </label>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={busy === "save"}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                {busy === "save" ? "Saving…" : editing ? "Save changes" : "Create"}
              </button>
              <button onClick={closeForm}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-zinc-500">
          No announcements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {a.pinned && (
                    <span className="rounded-full bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                      Pinned
                    </span>
                  )}
                  {a.published ? (
                    <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      Published
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Draft
                    </span>
                  )}
                  <h3 className="font-semibold text-zinc-100">{a.title}</h3>
                </div>
                <span className="text-xs text-zinc-600">{new Date(a.updatedAt).toLocaleDateString()}</span>
              </div>
              <p className="mb-3 line-clamp-2 text-xs text-zinc-400">{a.bodyMd}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(a)}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                  Edit
                </button>
                <button onClick={() => togglePublish(a)} disabled={busy === a.id}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40">
                  {a.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => togglePin(a)} disabled={busy === `pin-${a.id}`}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40">
                  {a.pinned ? "Unpin" : "Pin"}
                </button>
                <button onClick={() => del(a)} disabled={busy === `del-${a.id}`}
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
