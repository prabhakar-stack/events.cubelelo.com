"use client";

import { useBodyClass } from "@/hooks/useBodyClass";

export function BodyClass({ className }: { className: string }) {
  useBodyClass(className);
  return null;
}
