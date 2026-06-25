import type { Solve } from "@cubers/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface RoundRef {
  id: string;
  roundNumber: number;
  status: string;
  eventType: string;
}

export interface CompetitionDetail {
  id: string;
  title: string;
  status: string;
  events: { id: string; eventType: string; rounds: RoundRef[] }[];
}

export interface ResultDto {
  id: string;
  userId: string;
  ao5Ms: number | null;
  bestSingleMs: number | null;
  rank: number | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchCompetition(id: string): Promise<CompetitionDetail> {
  return getJson<CompetitionDetail>(`/api/v1/competitions/${id}`);
}

export function fetchScramble(
  roundId: string,
): Promise<{ roundId: string; scrambles: string[] }> {
  return getJson(`/api/v1/rounds/${roundId}/scramble`);
}

export async function submitResult(
  roundId: string,
  body: { userId: string; solves: Solve[]; videoUrl?: string },
): Promise<ResultDto> {
  const res = await fetch(`${BASE_URL}/api/v1/rounds/${roundId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
  return res.json() as Promise<ResultDto>;
}

export function fetchLeaderboard(roundId: string): Promise<ResultDto[]> {
  return getJson<ResultDto[]>(`/api/v1/rounds/${roundId}/results`);
}
