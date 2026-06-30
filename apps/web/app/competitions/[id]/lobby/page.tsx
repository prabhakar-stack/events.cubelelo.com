"use client";

import { useSearchParams } from "next/navigation";
import { CompetitionLobby } from "@/features/lobby/CompetitionLobby";
import type { EventId } from "@cubers/scramble-core";
import { isEventId } from "@cubers/scramble-core";

export default function LobbyPage({
  params,
}: {
  params: { id: string };
}) {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("eventId") ?? "333";
  const eventId: EventId = isEventId(eventParam) ? eventParam : "333";

  return <CompetitionLobby competitionId={params.id} round="1" eventId={eventId} />;
}
