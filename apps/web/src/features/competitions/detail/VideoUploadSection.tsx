"use client";

import { useState } from "react";
import { updateResultVideo } from "@/lib/api";

function fmtCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoUploadSection({
  resultId,
  currentVideoUrl,
  remaining,
  onUpdate,
}: {
  resultId: string;
  currentVideoUrl: string | null;
  remaining: number;
  onUpdate: () => void;
}) {
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmitVideo = async () => {
    if (!videoUrl.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await updateResultVideo(resultId, videoUrl.trim());
      setMsg({ type: "ok", text: "Video URL saved!" });
      onUpdate();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {currentVideoUrl ? "Update Video Link" : "Submit Video Link"}
        </span>
        <span className="font-mono text-xs text-amber-500">
          {fmtCountdown(remaining)} left
        </span>
      </div>
      {currentVideoUrl && (
        <p className="mb-2 text-xs text-zinc-500">
          Current: <a href={currentVideoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{currentVideoUrl}</a>
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Paste video link (YouTube / Drive)"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <button
          onClick={handleSubmitVideo}
          disabled={busy || !videoUrl.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : currentVideoUrl ? "Update" : "Submit"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.type === "ok" ? "text-emerald-500" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
