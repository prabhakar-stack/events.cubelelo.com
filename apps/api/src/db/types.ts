import type {
  CompStatus,
  CompType,
  RoundStatus,
  FlagStatus,
  Solve,
} from "@cubers/types";

/**
 * In-memory domain model. Field names are camelCase to match the JSON the API
 * returns. This mirrors packages/database/schema.sql and will be swapped for a
 * Postgres-backed repository once Supabase is provisioned — the route layer
 * depends only on the repository interface, not on these Maps.
 */
export interface Competition {
  id: string;
  title: string;
  type: CompType;
  status: CompStatus;
}

export interface CompetitionEvent {
  id: string;
  competitionId: string;
  eventType: string;
  roundCount: number;
}

export interface Round {
  id: string;
  competitionEventId: string;
  roundNumber: number;
  status: RoundStatus;
  opensAt?: string;
  closesAt?: string;
}

export interface ScrambleSet {
  id: string;
  roundId: string;
  scrambles: string[];
  generatedAt: string;
  lockedAt?: string;
  lockedBy?: string;
}

export interface Result {
  id: string;
  roundId: string;
  userId: string;
  solves: Solve[];
  bestSingleMs: number | null;
  ao5Ms: number | null;
  meanMs: number | null;
  medianMs: number | null;
  stdMs: number | null;
  rank: number | null;
  videoUrl: string | null;
  flagStatus: FlagStatus;
  submittedAt: string;
}
