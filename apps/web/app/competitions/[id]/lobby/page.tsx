import { CompetitionLobby } from "@/features/lobby/CompetitionLobby";

export default function LobbyPage({
  params,
}: {
  params: { id: string };
}) {
  // Demo wiring: 3x3, round 1. Production resolves the active round per event.
  return <CompetitionLobby competitionId={params.id} round="1" eventId="333" />;
}
