"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";

export default function MyProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else {
      router.replace(`/profile/${user.clId}`);
    }
  }, [user, loading, router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center text-zinc-500">
      Loading…
    </main>
  );
}
