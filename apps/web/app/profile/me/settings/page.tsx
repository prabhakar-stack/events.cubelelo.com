"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
      Redirecting…
    </main>
  );
}
