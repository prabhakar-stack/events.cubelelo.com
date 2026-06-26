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
  city?: string;
  state?: string;
  country?: string;
  instagram?: string;
  wcaId?: string;
  wcaVerified?: boolean;
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
  description?: string;
  baseFee?: number;
  perEventFee?: number;
  registrationDeadline?: string;
  coverUrl?: string;
  createdAt?: string;
  eventTypes?: string[];
  registrationCount?: number;
}

export interface EventDetail {
  id: string;
  eventType: string;
  roundCount: number;
  cutoffMs?: number;
  timeLimitMs?: number;
  rounds: RoundRef[];
}

export interface CompetitionDetail {
  id: string;
  title: string;
  type: string;
  status: string;
  description?: string;
  rulesMd?: string;
  baseFee?: number;
  perEventFee?: number;
  registrationDeadline?: string;
  coverUrl?: string;
  bannerUrl?: string;
  createdBy?: string;
  createdAt?: string;
  registrationCount?: number;
  events: EventDetail[];
}

export interface ResultDto {
  id: string;
  userId: string;
  roundId?: string;
  ao5Ms: number | null;
  bestSingleMs: number | null;
  rank: number | null;
  solves?: Solve[];
  flagStatus?: string;
  videoUrl?: string;
}

export interface FlaggedResultDto {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userClId: string;
  eventType: string;
  roundNumber: number | null;
  ao5Ms: number | null;
  bestSingleMs: number | null;
  solves: Solve[];
  videoUrl: string | null;
  flagStatus: string;
  suspicionReasons: string[];
  submittedAt: string;
}

export interface RegistrationDto {
  id: string;
  competitionId: string;
  competitionTitle: string;
  paymentStatus: string;
  events: { id: string; eventType: string }[];
  createdAt: string;
}

export interface ProfileRoundResult {
  roundNumber: number;
  rank: number | null;
  bestSingleMs: number | null;
  ao5Ms: number | null;
  solves: Solve[];
}

export interface ProfileEventResult {
  eventType: string;
  rounds: ProfileRoundResult[];
}

export interface ProfileCompetitionEntry {
  competitionId: string;
  competitionTitle: string;
  status: string;
  events: ProfileEventResult[];
}

export interface UserProfile {
  clId: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  avatarUrl?: string;
  instagram?: string;
  wcaId?: string;
  wcaVerified?: boolean;
  createdAt?: string;
  personalBests: Record<string, { bestSingle: number | null; bestAo5: number | null }>;
  stats: {
    totalCompetitions: number;
    totalSolves: number;
    eventStats: Record<string, { mean: number | null; stdDev: number | null; solveCount: number }>;
    solveTimeline: Record<string, Array<{ timeMs: number; ao5Ms: number | null; date: string; compTitle: string }>>;
  };
  competitionHistory: ProfileCompetitionEntry[];
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

// ── Competitions ──
export function fetchCompetitions(status?: string): Promise<CompetitionSummary[]> {
  const qs = status ? `?status=${status}` : "";
  return getJson<CompetitionSummary[]>(`/api/v1/competitions${qs}`);
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
  return sendJson("POST", `/api/v1/rounds/${roundId}/results`, body);
}

export function fetchLeaderboard(roundId: string): Promise<ResultDto[]> {
  return getJson<ResultDto[]>(`/api/v1/rounds/${roundId}/results`);
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

// ── Lobby ──
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

// ── Registration ──
export function registerForCompetition(
  competitionId: string,
  eventIds: string[],
): Promise<{ registrationId: string; totalFee: number; paymentStatus: string }> {
  return sendJson("POST", `/api/v1/competitions/${competitionId}/register`, {
    eventIds,
  });
}

export function fetchMyRegistrations(): Promise<RegistrationDto[]> {
  return getJson<RegistrationDto[]>(`/api/v1/me/registrations`);
}

// ── Payments ──
export function createPaymentOrder(
  registrationId: string,
): Promise<{ orderId: string; amount: number; currency: string; paymentId: string }> {
  return sendJson("POST", `/api/v1/payments/order`, { registrationId });
}

// ── User Profiles ──
export function fetchUserProfile(clId: string): Promise<UserProfile> {
  return getJson<UserProfile>(`/api/v1/users/${clId}`);
}

export function updateMyProfile(
  fields: Record<string, string>,
): Promise<AuthUser> {
  return sendJson("PATCH", `/api/v1/users/me`, fields);
}

// ── Admin ──
export function createCompetition(body: {
  title: string;
  type: string;
  description?: string;
  rulesMd?: string;
  baseFee?: number;
  perEventFee?: number;
  registrationDeadline?: string;
  eventType?: string;
  roundCount?: number;
  events?: Array<{ eventType: string; roundCount?: number; cutoffMs?: number; timeLimitMs?: number }>;
}): Promise<{ id: string }> {
  return sendJson("POST", `/api/v1/admin/competitions`, body);
}

export function updateCompetition(
  id: string,
  body: {
    title?: string;
    status?: string;
    description?: string;
    rulesMd?: string;
    baseFee?: number;
    perEventFee?: number;
    registrationDeadline?: string;
  },
): Promise<{ id: string; title: string; status: string }> {
  return sendJson("PATCH", `/api/v1/admin/competitions/${id}`, body);
}

export function duplicateCompetition(
  id: string,
  body: { reuseScrambles?: boolean; type?: string },
): Promise<{ id: string; title: string }> {
  return sendJson("POST", `/api/v1/admin/competitions/${id}/duplicate`, body);
}

export function fetchAdminScrambles(
  roundId: string,
): Promise<{ roundId: string; scrambles: string[]; locked: boolean; generatedAt?: string; lockedAt?: string }> {
  return getJson(`/api/v1/admin/rounds/${roundId}/scrambles`);
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

export function fetchVerificationQueue(
  competitionId: string,
): Promise<FlaggedResultDto[]> {
  return getJson<FlaggedResultDto[]>(`/api/v1/admin/competitions/${competitionId}/queue`);
}

export function verifyResult(
  resultId: string,
  action: string,
  reason?: string,
): Promise<{ id: string; flagStatus: string }> {
  return sendJson("POST", `/api/v1/admin/results/${resultId}/verify`, {
    action,
    reason,
  });
}
