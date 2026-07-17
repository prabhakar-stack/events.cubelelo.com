import { RouteGuard } from "@/features/auth/RouteGuard";
import { BodyClass } from "@/components/BodyClass";

export default function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard role={["judge", "moderator", "admin"]}>
      <BodyClass className="no-bg" />
      {children}
    </RouteGuard>
  );
}
