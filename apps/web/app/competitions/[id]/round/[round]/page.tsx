import { CompetitionTerminal } from "@/features/terminal/CompetitionTerminal";

export default function RoundPage({
  params,
}: {
  params: { id: string; round: string };
}) {
  // Demo wiring: 3x3, scrambles generated client-side. Production fetches the
  // server-locked scramble set for this round from the API at round-open.
  return (
    <CompetitionTerminal
      competitionId={params.id}
      round={params.round}
      eventId="333"
    />
  );
}
