import { RouteGuard } from "@/features/auth/RouteGuard";

export default function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard role={["judge", "moderator", "admin"]}>{children}</RouteGuard>;
}
