"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import Link from "next/link";
import { RouteGuard } from "@/features/auth/RouteGuard";
import { updateMyProfile, uploadAvatar, changePassword, deleteMyAccount } from "@/lib/api";
import { useTheme } from "@/features/theme/ThemeProvider";

const FIELDS = [
  { key: "name", label: "Display Name", type: "text" },
  { key: "lastName", label: "Last Name", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "country", label: "Country", type: "text" },
  { key: "instagram", label: "Instagram", type: "text" },
  { key: "dob", label: "Date of Birth", type: "date" },
  { key: "mobileNo", label: "Mobile Number", type: "tel" },
  { key: "gender", label: "Gender", type: "text" },
] as const;

function SettingsContent() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const initial: Record<string, string> = {};
      for (const f of FIELDS) {
        const val = (user as unknown as Record<string, unknown>)[f.key];
        initial[f.key] = typeof val === "string" ? val : "";
      }
      setForm(initial);
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updates: Record<string, string> = {};
      for (const f of FIELDS) {
        if (form[f.key]?.trim()) updates[f.key] = form[f.key].trim();
      }
      await updateMyProfile(updates);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">Settings</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="font-mono text-emerald-600 dark:text-emerald-400">{user!.clId}</span>
        {" · "}
        {user!.email}
      </p>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-2xl text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {(user as unknown as Record<string, unknown>).avatarUrl ? (
            <img
              src={String((user as unknown as Record<string, unknown>).avatarUrl)}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            user!.name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <label className="cursor-pointer rounded bg-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
            {avatarUploading ? "Uploading..." : "Change Avatar"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              disabled={avatarUploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAvatarUploading(true);
                setError(null);
                try {
                  await uploadAvatar(file);
                  window.location.reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setAvatarUploading(false);
                }
              }}
            />
          </label>
          <p className="mt-1 text-xs text-zinc-500">Max 2MB. JPG, PNG, GIF, WebP.</p>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div>
          <p className="text-sm font-medium">Theme</p>
          <p className="text-xs text-zinc-500">Switch between dark and light mode</p>
        </div>
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      {/* Profile privacy toggle */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div>
          <p className="text-sm font-medium">Profile Privacy</p>
          <p className="text-xs text-zinc-500">Private hides solve history and stats from other users</p>
        </div>
        <button
          onClick={async () => {
            const next = (user as unknown as Record<string, unknown>).profilePrivacy === "private" ? "public" : "private";
            try {
              await updateMyProfile({ profilePrivacy: next });
              window.location.reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          {(user as unknown as Record<string, unknown>).profilePrivacy === "private" ? "Make Public" : "Make Private"}
        </button>
      </div>

      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
              {f.label}
            </label>
            <input
              type={f.type}
              value={form[f.key] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {saved && (
        <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">Profile updated!</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {/* Legacy Account Claim */}
      <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-sm font-medium">Legacy Account</p>
        <p className="text-xs text-zinc-500">Link a legacy cubelelo-event profile to this account</p>
        <Link
          href="/register/migrate"
          className="mt-2 inline-block text-sm text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Claim legacy account →
        </Link>
      </div>

      {/* Password Change */}
      <div className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-bold">Change Password</h2>
        <div className="space-y-4">
          {Boolean((user as unknown as Record<string, unknown>).passwordHash) && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Current Password</label>
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">New Password</label>
            <input
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Confirm New Password</label>
            <input
              type="password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
        {pwError && <p className="mt-3 text-sm text-red-400">{pwError}</p>}
        {pwMsg && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{pwMsg}</p>}
        <button
          onClick={async () => {
            setPwError(null);
            setPwMsg(null);
            if (pwNew.length < 6) { setPwError("Password must be at least 6 characters"); return; }
            if (pwNew !== pwConfirm) { setPwError("Passwords do not match"); return; }
            setPwSaving(true);
            try {
              await changePassword(pwCurrent, pwNew);
              setPwMsg("Password updated!");
              setPwCurrent("");
              setPwNew("");
              setPwConfirm("");
            } catch (e) {
              setPwError(e instanceof Error ? e.message : String(e));
            } finally {
              setPwSaving(false);
            }
          }}
          disabled={pwSaving || !pwNew}
          className="mt-4 w-full rounded-lg bg-zinc-800 px-6 py-3 font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {pwSaving ? "Updating…" : "Update Password"}
        </button>
      </div>

      {/* Delete Account */}
      <div className="mt-10 border-t border-red-200 pt-8 dark:border-red-900/50">
        <h2 className="mb-2 text-lg font-bold text-red-500">Delete Account</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={async () => {
            if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
            if (!confirm("This will permanently remove all your data including competition results, registrations, and practice sessions. Continue?")) return;
            try {
              await deleteMyAccount();
              window.location.href = "/";
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500"
        >
          Delete My Account
        </button>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <RouteGuard>
      <SettingsContent />
    </RouteGuard>
  );
}
