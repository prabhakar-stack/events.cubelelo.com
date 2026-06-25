import { AdminCompetition } from "@/features/admin/AdminCompetition";

export default function AdminCompetitionPage({
  params,
}: {
  params: { id: string };
}) {
  return <AdminCompetition id={params.id} />;
}
