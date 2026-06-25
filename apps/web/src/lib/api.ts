import type { Solve } from "@cubers/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Auth token (set by the AuthProvider; attached to every request) ──
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}
function authHeaders(): Record<string, string> {
  return authToken ? { authorization: `Bearer ${authToken}` } : {};
}

export interface AuthUser {
  id: string;
  clId: string;
  email: string;
  name: string;
  role: string;
}

export interface RoundRef {
  id: string;
  roundNumber: number;
  status: string;
  eventType: string;
  scrambleLocked?: boolean;
}

export interface CompetitionSummary {
  id: string;
  title: string;
  type: string;
  status: string;
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
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

async function sendJson<T>(
  method: "POST" | "PATCH",
  path: string,
  body?: object,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status} ${res.statusText} ${detail}`);
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

export function submitResult(
  roundId: string,
  body: { solves: Solve[]; videoUrl?: string },
): Promise<ResultDto> {
  // userId is derived server-side from the authenticated user's CL ID.
  return sendJson("POST", `/api/v1/rounds/${roundId}/results`, body);
}

// ── Auth ──
export function devLogin(
  email: string,
  name?: string,
): Promise<{ token: string }> {
  return sendJson("POST", `/api/v1/auth/dev-login`, { email, name });
}

export function syncUser(): Promise<AuthUser> {
  return sendJson("POST", `/api/v1/auth/sync`);
}

export function fetchMe(): Promise<AuthUser> {
  return getJson<AuthUser>(`/api/v1/users/me`);
}

export function fetchLeaderboard(roundId: string): Promise<ResultDto[]> {
  return getJson<ResultDto[]>(`/api/v1/rounds/${roundId}/results`);
}

export interface RosterEntry {
  userId: string;
  name: string;
}

export interface LobbyState {
  round: {
    id: string;
    roundNumber: number;
    status: string;
    opensAt: string | null;
    eventType: string | null;
  };
  competition: { id: string | null; title: string | null; rulesMd: string | null };
  roster: RosterEntry[];
}

export function fetchLobby(roundId: string): Promise<LobbyState> {
  return getJson<LobbyState>(`/api/v1/rounds/${roundId}/lobby`);
}

// ── Admin ──
export function fetchCompetitions(): Promise<CompetitionSummary[]> {
  return getJson<CompetitionSummary[]>(`/api/v1/competitions`);
}

export function createCompetition(body: {
  title: string;
  type: string;
  eventType: string;
  roundCount: number;
}): Promise<{ id: string }> {
  return sendJson("POST", `/api/v1/admin/competitions`, body);
}

export function updateCompetition(
  id: string,
  body: { title?: string; status?: string; rulesMd?: string },
): Promise<{ id: string; title: string; status: string }> {
  return sendJson("PATCH", `/api/v1/admin/competitions/${id}`, body);
}

export function generateScrambles(
  roundId: string,
  count: number,
): Promise<{ roundId: string; count: number }> {
  return sendJson("POST", `/api/v1/admin/rounds/${roundId}/scrambles`, { count });
}

export function openRound(roundId: string): Promise<{ id: string; status: string }> {
  return sendJson("POST", `/api/v1/admin/rounds/${roundId}/open`);
}

export function closeRound(roundId: string): Promise<{ id: string; status: string }> {
  return sendJson("POST", `/api/v1/admin/rounds/${roundId}/close`);
}
