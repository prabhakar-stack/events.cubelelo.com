"use client";

import { CompetitionTerminal } from "@/features/terminal/CompetitionTerminal";
import { OnboardingModal, useOnboardingGate } from "@/features/onboarding/OnboardingModal";

export default function RoundPage({
  params,
}: {
  params: { id: string; round: string };
}) {
  const { needsOnboarding, markDone } = useOnboardingGate();

  return (
    <>
      {needsOnboarding && <OnboardingModal onComplete={markDone} />}
      <CompetitionTerminal
        competitionId={params.id}
        round={params.round}
        eventId="333"
      />
    </>
  );
}
