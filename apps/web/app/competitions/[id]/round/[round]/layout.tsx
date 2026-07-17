"use client";

import { useBodyClass } from "@/hooks/useBodyClass";

export default function RoundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useBodyClass("competition-mode");

  return <>{children}</>;
}
