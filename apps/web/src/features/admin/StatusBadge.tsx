import { StatusBadge as CanonicalStatusBadge, type StatusDomain } from "@/components/ui/Badge";

/** Thin wrapper kept for existing call sites — delegates to the single canonical status map. */
export function StatusBadge({ status, domain = "competition" }: { status: string; domain?: StatusDomain }) {
  return <CanonicalStatusBadge domain={domain} status={status} />;
}
