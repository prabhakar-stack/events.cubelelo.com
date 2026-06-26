"use client";

import { useParams } from "next/navigation";
import { redirect } from "next/navigation";

export default function VerificationQueuePage() {
  const params = useParams<{ id: string }>();
  redirect(`/admin/competitions/${params.id}`);
}
