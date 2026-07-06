import { RouteGuard } from "@/features/auth/RouteGuard";
import { AdminShell } from "@/features/admin/AdminShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard role="admin">
      <AdminShell>{children}</AdminShell>
    </RouteGuard>
  );
}
