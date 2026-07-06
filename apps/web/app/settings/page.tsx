"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import Link from "next/link";
import { RouteGuard } from "@/features/auth/RouteGuard";
import { updateMyProfile, uploadAvatar, changePassword, verifyEmailWithGoogle, setAuthToken, sendOtp, verifyOtp } from "@/lib/api";
import { useTheme } from "@/features/theme/ThemeProvider";
import { getSupabase } from "@/lib/supabase";
import { Country, State, City } from "country-state-city";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { GradientAvatar } from "@/components/GradientAvatar";

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"] as const;

function SettingsContent() {
  const { user, verifyWithGoogle, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
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
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Country/State/City cascading state
  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(() => countryCode ? State.getStatesOfCountry(countryCode) : [], [countryCode]);
  const cities = useMemo(() => countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : [], [countryCode, stateCode]);

  const countryOptions = useMemo(() => countries.map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` })), [countries]);
  const stateOptions = useMemo(() => states.map((s) => ({ value: s.isoCode, label: s.name })), [states]);
  const cityOptions = useMemo(() => cities.map((c) => ({ value: c.name, label: c.name })), [cities]);

  useEffect(() => {
    if (searchParams.get("verified") !== "1") return;
    if (!user || user.emailVerified) return;
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      const googleToken = data.session?.access_token;
      if (!googleToken || cancelled) return;
      setVerifying(true);
      try {
        await verifyEmailWithGoogle(googleToken);
        if (!cancelled) {
          setVerifyMsg("Email verified successfully!");
          setUser({ ...user, emailVerified: true });
        }
      } catch (e) {
        if (!cancelled) setVerifyError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setVerifying(false);
      }
      await sb.auth.signOut();
      const origToken = localStorage.getItem("cubers_token");
      if (origToken) setAuthToken(origToken);
      window.history.replaceState({}, "", "/settings");
    })();
    return () => { cancelled = true; };
  }, [searchParams, user, setUser]);

  useEffect(() => {
    if (!user) return;
    const u = user as unknown as Record<string, unknown>;
    const initial: Record<string, string> = {};
    const textFields = ["name", "lastName", "mobileNo", "dob", "gender", "address", "landmark", "pincode", "instagram"];
    for (const key of textFields) {
      const val = u[key];
      initial[key] = typeof val === "string" ? val : "";
    }
    initial.country = typeof u.country === "string" ? u.country : "";
    initial.state = typeof u.state === "string" ? u.state : "";
    initial.city = typeof u.city === "string" ? u.city : "";
    setForm(initial);

    // Resolve country/state codes from names for the cascading dropdowns
    if (initial.country) {
      const match = countries.find((c) => c.name === initial.country);
      if (match) {
        setCountryCode(match.isoCode);
        if (initial.state) {
          const statesList = State.getStatesOfCountry(match.isoCode);
          const sm = statesList.find((s) => s.name === initial.state);
          if (sm) setStateCode(sm.isoCode);
        }
      }
    }
  }, [user, countries]);

  const handleCountryChange = (isoCode: string) => {
    setCountryCode(isoCode);
    setStateCode("");
    const c = countries.find((c) => c.isoCode === isoCode);
    setForm((prev) => ({ ...prev, country: c?.name ?? "", state: "", city: "" }));
  };

  const handleStateChange = (isoCode: string) => {
    setStateCode(isoCode);
    const s = states.find((s) => s.isoCode === isoCode);
    setForm((prev) => ({ ...prev, state: s?.name ?? "", city: "" }));
  };

  const handleCityChange = (name: string) => {
    setForm((prev) => ({ ...prev, city: name }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updates: Record<string, string> = {};
      const allKeys = ["name", "lastName", "mobileNo", "dob", "gender", "country", "state", "city", "address", "landmark", "pincode", "instagram"];
      for (const key of allKeys) {
        if (form[key]?.trim()) updates[key] = form[key].trim();
      }
      await updateMyProfile(updates);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="font-mono text-emerald-600 dark:text-emerald-400">{user!.clId}</span>
        {" · "}
        {user!.email || "No email set"}
      </p>

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full">
          {(user as unknown as Record<string, unknown>).avatarUrl ? (
            <img
              src={String((user as unknown as Record<string, unknown>).avatarUrl)}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <GradientAvatar name={user!.name} size={64} className="text-2xl" />
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
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Theme</p>
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
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Profile Privacy</p>
          <p className="text-xs text-zinc-500">Private hides solve history and stats from other users</p>
        </div>
        <button
          onClick={async () => {
            const next = user!.profilePrivacy === "private" ? "public" : "private";
            try {
              await updateMyProfile({ profilePrivacy: next });
              setUser({ ...user!, profilePrivacy: next });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          {user!.profilePrivacy === "private" ? "Make Public" : "Make Private"}
        </button>
      </div>

      {/* Change Password (moved up) */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Password</p>
            <p className="text-xs text-zinc-500">
              {user!.hasPassword
                ? "Update your account password"
                : "Set a password (currently using Google sign-in only)"}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {Boolean(user!.hasPassword) && (
            <Input
              type="password"
              placeholder="Current password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              autoComplete="current-password"
            />
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="password"
                placeholder="New password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex-1">
              <Input
                type="password"
                placeholder="Confirm"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>
        {pwError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{pwError}</p>}
        {pwMsg && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{pwMsg}</p>}
        <Button
          fullWidth
          className="mt-3"
          loading={pwSaving}
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
          disabled={!pwNew}
        >
          Update Password
        </Button>
      </div>

      {/* Email Verification */}
      {!user!.emailVerified && (
        <OtpVerifySection
          type="email"
          currentValue={user!.email}
          label="Email"
          placeholder="you@example.com"
          icon="&#x2709;"
          onVerified={() => setUser({ ...user!, emailVerified: true })}
          verifyWithGoogle={verifyWithGoogle}
          verifying={verifying}
          verifyMsg={verifyMsg}
          verifyError={verifyError}
        />
      )}

      {/* Mobile Verification */}
      {!user!.mobileVerified && (
        <OtpVerifySection
          type="mobile"
          currentValue={user!.mobileNo || ""}
          label="Mobile Number"
          placeholder="+919876543210"
          icon="&#x1F4F1;"
          onVerified={() => setUser({ ...user!, mobileVerified: true })}
        />
      )}

      {/* Verification status badges */}
      {(user!.emailVerified || user!.mobileVerified) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {user!.emailVerified && (
            <span className="rounded-full bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-400">
              Email Verified
            </span>
          )}
          {user!.mobileVerified && (
            <span className="rounded-full bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-400">
              Mobile Verified
            </span>
          )}
        </div>
      )}

      {/* ── Profile Form ── */}
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Profile Information</h2>

      <div className="space-y-4">
        {/* Name fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Display Name</label>
            <input type="text" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Last Name</label>
            <input type="text" value={form.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Mobile Number</label>
          <input type="tel" value={form.mobileNo ?? ""} onChange={(e) => set("mobileNo", e.target.value)}
            placeholder="+919876543210"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>

        {/* DOB + Gender row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Date of Birth</label>
            <input type="date" value={form.dob ?? ""} onChange={(e) => set("dob", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Gender</label>
            <select value={form.gender ?? ""} onChange={(e) => set("gender", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Country / State / City — searchable dropdowns */}
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Country</label>
          <SearchableSelect
            options={countryOptions}
            value={countryCode}
            onChange={handleCountryChange}
            placeholder="Search country…"
          />
        </div>

        {countryCode && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">State</label>
              <SearchableSelect
                options={stateOptions}
                value={stateCode}
                onChange={handleStateChange}
                placeholder="Search state…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">City</label>
              {cityOptions.length > 0 ? (
                <SearchableSelect
                  options={cityOptions}
                  value={form.city ?? ""}
                  onChange={handleCityChange}
                  placeholder="Search city…"
                />
              ) : (
                <input type="text" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)}
                  placeholder="City name"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              )}
            </div>
          </div>
        )}

        {/* Address fields */}
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Address</label>
          <input type="text" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)}
            placeholder="Street address"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Landmark</label>
            <input type="text" value={form.landmark ?? ""} onChange={(e) => set("landmark", e.target.value)}
              placeholder="Near…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Pincode</label>
            <input type="text" value={form.pincode ?? ""} onChange={(e) => set("pincode", e.target.value)}
              placeholder="110001"
              maxLength={10}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          </div>
        </div>

        {/* Social — at the bottom */}
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Instagram</label>
          <input type="text" value={form.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)}
            placeholder="@username"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
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
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Legacy Account</p>
        <p className="text-xs text-zinc-500">Link a legacy cubelelo-event profile to this account</p>
        <Link
          href="/register/migrate"
          className="mt-2 inline-block text-sm text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Claim legacy account →
        </Link>
      </div>
    </main>
  );
}

function OtpVerifySection({
  type,
  currentValue,
  label,
  placeholder,
  icon,
  onVerified,
  verifyWithGoogle,
  verifying,
  verifyMsg,
  verifyError,
}: {
  type: "email" | "mobile";
  currentValue: string;
  label: string;
  placeholder: string;
  icon: string;
  onVerified: () => void;
  verifyWithGoogle?: () => void;
  verifying?: boolean;
  verifyMsg?: string | null;
  verifyError?: string | null;
}) {
  const [value, setValue] = useState(currentValue);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSendOtp = async () => {
    if (!value.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendOtp(type, value.trim());
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim() || code.trim().length !== 6) return;
    setChecking(true);
    setError(null);
    try {
      await verifyOtp(type, value.trim(), code.trim());
      setSuccess(true);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  if (success) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{label} Not Verified</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Verify your {label.toLowerCase()} to participate in competitions
          </p>
        </div>
      </div>

      {!otpSent ? (
        <div className="mt-2 flex gap-2">
          <input
            type={type === "email" ? "email" : "tel"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none dark:border-amber-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={handleSendOtp}
            disabled={sending || !value.trim()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send OTP"}
          </button>
          {type === "email" && verifyWithGoogle && (
            <button
              onClick={verifyWithGoogle}
              disabled={verifying}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200"
            >
              {verifying ? "…" : "Google"}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            OTP sent to <span className="font-medium">{value}</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-center text-sm font-bold tracking-widest focus:border-amber-500 focus:outline-none dark:border-amber-700 dark:bg-zinc-900 dark:text-zinc-100"
              autoFocus
            />
            <button
              onClick={handleVerify}
              disabled={checking || code.length !== 6}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {checking ? "…" : "Verify"}
            </button>
          </div>
          <button
            onClick={() => { setOtpSent(false); setCode(""); setError(null); }}
            className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400"
          >
            Change {label.toLowerCase()} / Resend
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {verifyMsg && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{verifyMsg}</p>}
      {verifyError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{verifyError}</p>}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RouteGuard>
      <SettingsContent />
    </RouteGuard>
  );
}
