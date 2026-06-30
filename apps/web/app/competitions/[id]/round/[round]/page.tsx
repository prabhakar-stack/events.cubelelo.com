"use client";

import { useSearchParams } from "next/navigation";
import { CompetitionTerminal } from "@/features/terminal/CompetitionTerminal";
import { OnboardingModal, useOnboardingGate } from "@/features/onboarding/OnboardingModal";
import type { EventId } from "@cubers/scramble-core";
import { isEventId } from "@cubers/scramble-core";

export default function RoundPage({
  params,
}: {
  params: { id: string; round: string };
}) {
  const { needsOnboarding, markDone } = useOnboardingGate();
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("eventId") ?? "333";
  const eventId: EventId = isEventId(eventParam) ? eventParam : "333";

  return (
    <>
      {needsOnboarding && <OnboardingModal onComplete={markDone} />}
      <CompetitionTerminal
        competitionId={params.id}
        round={params.round}
        eventId={eventId}
      />
    </>
  );
}
