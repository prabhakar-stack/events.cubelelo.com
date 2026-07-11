"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EventRedirect() {
  const params = useParams<{ id: string; eventId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/competitions/${params.id}#event-${params.eventId}`);
  }, [params.id, params.eventId, router]);

  return null;
}
