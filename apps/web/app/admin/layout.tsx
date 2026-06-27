import { RouteGuard } from "@/features/auth/RouteGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard role="admin">{children}</RouteGuard>;
}
