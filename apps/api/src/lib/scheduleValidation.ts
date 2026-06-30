import type { Competition, Round } from "../db/types";

export interface ScheduleValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCompetitionSchedule(
  comp: Partial<Competition>,
  rounds: Round[],
  requireAllRoundTimes = true,
): ScheduleValidationResult {
  const errors: string[] = [];

  const regOpens = comp.registrationOpensAt ? +new Date(comp.registrationOpensAt) : null;
  const regCloses = comp.registrationDeadline ? +new Date(comp.registrationDeadline) : null;
  const starts = comp.startsAt ? +new Date(comp.startsAt) : null;
  const ends = comp.endsAt ? +new Date(comp.endsAt) : null;

  if (!starts) errors.push("Competition start time is required");
  if (!ends) errors.push("Competition end time is required");

  if (regOpens !== null && regCloses !== null && regOpens >= regCloses) {
    errors.push("Registration open must be before registration close");
  }
  if (regCloses !== null && starts !== null && regCloses > starts) {
    errors.push("Registration close must be at or before competition start");
  }
  if (starts !== null && ends !== null && starts >= ends) {
    errors.push("Competition start must be before competition end");
  }

  // Group rounds by competitionEventId
  const byEvent = new Map<string, Round[]>();
  for (const r of rounds) {
    const list = byEvent.get(r.competitionEventId) ?? [];
    list.push(r);
    byEvent.set(r.competitionEventId, list);
  }

  for (const [, eventRounds] of byEvent) {
    const sorted = [...eventRounds].sort((a, b) => a.roundNumber - b.roundNumber);

    for (const r of sorted) {
      const rOpen = r.opensAt ? +new Date(r.opensAt) : null;
      const rClose = r.closesAt ? +new Date(r.closesAt) : null;
      const label = `Round ${r.roundNumber}`;

      if (requireAllRoundTimes) {
        if (!rOpen) errors.push(`${label}: start time is required`);
        if (!rClose) errors.push(`${label}: end time is required`);
      }

      if (rOpen !== null && rClose !== null && rOpen >= rClose) {
        errors.push(`${label}: start must be before end`);
      }

      if (starts !== null && rOpen !== null && rOpen < starts) {
        errors.push(`${label}: starts before competition start`);
      }
      if (ends !== null && rClose !== null && rClose > ends) {
        errors.push(`${label}: ends after competition end`);
      }
    }

    // Check sequential ordering (no overlaps)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const prevClose = prev.closesAt ? +new Date(prev.closesAt) : null;
      const currOpen = curr.opensAt ? +new Date(curr.opensAt) : null;

      if (prevClose !== null && currOpen !== null && prevClose > currOpen) {
        errors.push(
          `Round ${prev.roundNumber} must end before Round ${curr.roundNumber} starts`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateScheduleFields(
  merged: Partial<Competition>,
): ScheduleValidationResult {
  const errors: string[] = [];

  const regOpens = merged.registrationOpensAt ? +new Date(merged.registrationOpensAt) : null;
  const regCloses = merged.registrationDeadline ? +new Date(merged.registrationDeadline) : null;
  const starts = merged.startsAt ? +new Date(merged.startsAt) : null;
  const ends = merged.endsAt ? +new Date(merged.endsAt) : null;

  if (regOpens !== null && regCloses !== null && regOpens >= regCloses) {
    errors.push("Registration open must be before registration close");
  }
  if (regCloses !== null && starts !== null && regCloses > starts) {
    errors.push("Registration close must be at or before competition start");
  }
  if (starts !== null && ends !== null && starts >= ends) {
    errors.push("Competition start must be before competition end");
  }

  return { valid: errors.length === 0, errors };
}

export function validateRoundTimes(
  round: Round,
  siblings: Round[],
  comp: Partial<Competition>,
): ScheduleValidationResult {
  const errors: string[] = [];
  const rOpen = round.opensAt ? +new Date(round.opensAt) : null;
  const rClose = round.closesAt ? +new Date(round.closesAt) : null;
  const starts = comp.startsAt ? +new Date(comp.startsAt) : null;
  const ends = comp.endsAt ? +new Date(comp.endsAt) : null;

  if (rOpen !== null && rClose !== null && rOpen >= rClose) {
    errors.push("Round start must be before round end");
  }
  if (starts !== null && rOpen !== null && rOpen < starts) {
    errors.push("Round starts before competition start");
  }
  if (ends !== null && rClose !== null && rClose > ends) {
    errors.push("Round ends after competition end");
  }

  for (const sib of siblings) {
    if (sib.id === round.id) continue;
    const sibOpen = sib.opensAt ? +new Date(sib.opensAt) : null;
    const sibClose = sib.closesAt ? +new Date(sib.closesAt) : null;

    if (sib.roundNumber < round.roundNumber && sibClose !== null && rOpen !== null && sibClose > rOpen) {
      errors.push(`Round ${sib.roundNumber} must end before Round ${round.roundNumber} starts`);
    }
    if (sib.roundNumber > round.roundNumber && rClose !== null && sibOpen !== null && rClose > sibOpen) {
      errors.push(`Round ${round.roundNumber} must end before Round ${sib.roundNumber} starts`);
    }
  }

  return { valid: errors.length === 0, errors };
}
