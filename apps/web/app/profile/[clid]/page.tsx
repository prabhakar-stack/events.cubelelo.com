"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchUserProfile, type UserProfile } from "@/lib/api";
import { formatTime } from "@cubers/timer-core";

export default function ProfilePage() {
  const params = useParams<{ clid: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.clid) return;
    fetchUserProfile(params.clid)
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [params.clid]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Loading profile…
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-red-400">
        {error ?? "User not found"}
      </main>
    );
  }

  const pbEntries = Object.entries(profile.personalBests);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Identity block */}
      <div className="mb-8 flex items-start gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-xl font-bold text-zinc-400">
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{profile.name}</h1>
          <p className="font-mono text-sm text-emerald-400">{profile.clId}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
            {profile.city && <span>{profile.city}</span>}
            {profile.state && <span>{profile.state}</span>}
            {profile.country && <span>{profile.country}</span>}
            {profile.wcaId && (
              <span className={profile.wcaVerified ? "text-emerald-400" : ""}>
                WCA: {profile.wcaId}
                {profile.wcaVerified ? " ✓" : ""}
              </span>
            )}
            {profile.instagram && (
              <span className="text-zinc-400">{profile.instagram}</span>
            )}
          </div>
        </div>
      </div>

      {/* Personal Bests */}
      {pbEntries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Personal Bests
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3 text-right">Best Single</th>
                  <th className="px-4 py-3 text-right">Best ao5</th>
                </tr>
              </thead>
              <tbody>
                {pbEntries.map(([event, pb]) => (
                  <tr key={event} className="border-b border-zinc-800/50">
                    <td className="px-4 py-2.5 font-semibold text-zinc-200">
                      {event}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                      {pb.bestSingle !== null ? formatTime(pb.bestSingle) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                      {pb.bestAo5 !== null ? formatTime(pb.bestAo5) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Competition history */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Competition History
        </h2>
        {profile.competitionHistory.length === 0 ? (
          <p className="text-sm text-zinc-500">No competitions yet.</p>
        ) : (
          <div className="space-y-2">
            {profile.competitionHistory.map((h) => (
              <Link
                key={h.competitionId}
                href={`/competitions/${h.competitionId}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-700"
              >
                <span className="text-zinc-200">{h.competitionTitle}</span>
                <span className="text-xs text-zinc-500">
                  {h.events.join(", ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
