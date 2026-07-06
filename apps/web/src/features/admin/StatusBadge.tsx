import { StatusBadge as CanonicalStatusBadge } from "@/components/ui/Badge";

/** Thin wrapper kept for existing call sites — delegates to the single canonical status map. */
export function StatusBadge({ status }: { status: string }) {
  return <CanonicalStatusBadge domain="competition" status={status} />;
}
