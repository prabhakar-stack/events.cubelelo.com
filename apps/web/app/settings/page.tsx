"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { updateMyProfile } from "@/lib/api";

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

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

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

  if (!user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

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
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Settings</h1>
      <p className="mb-6 text-sm text-zinc-400">
        <span className="font-mono text-emerald-400">{user.clId}</span>
        {" · "}
        {user.email}
      </p>

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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {saved && (
        <p className="mt-4 text-sm text-emerald-400">Profile updated!</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </main>
  );
}
