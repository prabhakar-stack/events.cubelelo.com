"use client";

import { useEffect } from "react";

export default function RoundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.body.classList.add("competition-mode");
    return () => document.body.classList.remove("competition-mode");
  }, []);

  return <>{children}</>;
}
