import type { Solve } from "@cubers/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  opensAt?: string | null;
  closesAt?: string | null;
  advancementCount?: number | null;
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
  registrationOpensAt?: string | null;
  registrationDeadline?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
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
  profilePrivacy?: "public" | "private";
  createdAt?: string;
  personalBests: Record<string, { bestSingle: number | null; bestAo5: number | null }>;
  stats: {
    totalCompetitions: number;
    totalSolves: number;
    eventStats: Record<string, { mean: number | null; stdDev: number | null; solveCount: number }>;
    solveTimeline: Record<string, Array<{ timeMs: number; ao5Ms: number | null; date: string; compTitle: string }>>;
  } | null;
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

export interface RoundProgress {
  roundId: string;
  roundNumber: number;
  eventType: string | null;
  status: string;
  userStatus: string;
  result: { rank: number | null; ao5Ms: number | null; bestSingleMs: number | null } | null;
}

export function fetchMyProgress(compId: string): Promise<{ registered: boolean; rounds: RoundProgress[] }> {
  return getJson(`/api/v1/competitions/${compId}/my-progress`);
}

export interface LiveRankingEntry {
  userId: string;
  clId: string;
  name: string;
  rank: number | null;
  ao5Ms: number | null;
  bestSingleMs: number | null;
  flagStatus: string;
}

export function fetchLiveRanking(compId: string, event?: string): Promise<{
  roundId: string | null;
  roundNumber: number | null;
  eventType?: string;
  ranking: LiveRankingEntry[];
}> {
  const q = event ? `?event=${encodeURIComponent(event)}` : "";
  return getJson(`/api/v1/competitions/${compId}/live-ranking${q}`);
}

export interface ParticipantEntry {
  userId: string;
  clId: string;
  name: string;
  city: string | null;
  country: string | null;
  eventTypes: string[];
  registeredAt: string;
}

export function fetchParticipants(compId: string): Promise<{
  count: number;
  participants: ParticipantEntry[];
}> {
  return getJson(`/api/v1/competitions/${compId}/participants`);
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

export function authRegister(
  email: string,
  password: string,
  name?: string,
): Promise<{ token: string }> {
  return sendJson("POST", `/api/v1/auth/register`, { email, password, name });
}

export function authLogin(
  email: string,
  password: string,
): Promise<{ token: string }> {
  return sendJson("POST", `/api/v1/auth/login`, { email, password });
}

export function syncUser(): Promise<AuthUser> {
  return sendJson("POST", `/api/v1/auth/sync`);
}

export function verifyEmail(token: string): Promise<{ ok: boolean }> {
  return sendJson("POST", `/api/v1/auth/verify-email`, { token });
}

export function resendVerification(): Promise<{ ok: boolean }> {
  return sendJson("POST", `/api/v1/auth/resend-verification`);
}

export function forgotPassword(email: string): Promise<{ ok: boolean }> {
  return sendJson("POST", `/api/v1/auth/forgot-password`, { email });
}

export function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  return sendJson("POST", `/api/v1/auth/reset-password`, { token, newPassword });
}

export function sendMigrationEmails(): Promise<{ totalStubs: number; sentCount: number }> {
  return sendJson("POST", `/api/v1/admin/migration/send-emails`);
}

export function migrateClaim(body: {
  legacyClId?: string;
  legacyEmail?: string;
}): Promise<AuthUser> {
  return sendJson("POST", `/api/v1/auth/migrate-claim`, body);
}

export function fetchMe(): Promise<AuthUser> {
  return getJson<AuthUser>(`/api/v1/users/me`);
}

export interface SearchResult {
  clId: string;
  name: string;
  avatarUrl?: string;
  city?: string;
  country?: string;
}

export function searchUsers(q: string): Promise<SearchResult[]> {
  return getJson<SearchResult[]>(`/api/v1/users/search?q=${encodeURIComponent(q)}`);
}

export interface GlobalSearchResult {
  type: "user" | "competition" | "announcement" | "page" | "admin";
  id: string;
  title: string;
  subtitle: string;
  href: string | null;
}

export function globalSearch(q: string): Promise<GlobalSearchResult[]> {
  return getJson<GlobalSearchResult[]>(`/api/v1/search?q=${encodeURIComponent(q)}`);
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

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return sendJson("POST", `/api/v1/auth/change-password`, { currentPassword, newPassword });
}

// ── Admin ──
export function createCompetition(body: {
  title: string;
  type: string;
  description?: string;
  rulesMd?: string;
  baseFee?: number;
  perEventFee?: number;
  registrationOpensAt?: string;
  registrationDeadline?: string;
  startsAt?: string;
  endsAt?: string;
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
    registrationOpensAt?: string | null;
    registrationDeadline?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
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

export function updateRound(
  roundId: string,
  body: { opensAt?: string | null; closesAt?: string | null; advancementCount?: number; durationMinutes?: number },
): Promise<{ id: string; status: string; opensAt: string | null; closesAt: string | null; durationMinutes?: number }> {
  return sendJson("PATCH", `/api/v1/admin/rounds/${roundId}`, body);
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

// ── Admin: users ──────────────────────────────────────────────────────────────

export interface AdminUserDto extends AuthUser {
  dob?: string;
  mobileNo?: string;
  accountStage: string;
  createdAt: string;
}

export function fetchAdminUsers(params?: {
  search?: string;
  role?: string;
  stage?: string;
}): Promise<AdminUserDto[]> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][],
  ).toString();
  return getJson<AdminUserDto[]>(`/api/v1/admin/users${qs ? `?${qs}` : ""}`);
}

export function updateAdminUser(
  id: string,
  body: { role?: string; accountStage?: string },
): Promise<AdminUserDto> {
  return sendJson("PATCH", `/api/v1/admin/users/${id}`, body);
}

// ── Admin: payments ───────────────────────────────────────────────────────────

export interface AdminPaymentDto {
  id: string;
  userId: string;
  registrationId: string;
  amount: number;
  currency: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: string;
  createdAt: string;
  userName: string;
  userClId: string;
  userEmail: string;
  competitionTitle: string;
}

export function fetchAdminPayments(status?: string): Promise<AdminPaymentDto[]> {
  const qs = status ? `?status=${status}` : "";
  return getJson<AdminPaymentDto[]>(`/api/v1/admin/payments${qs}`);
}

// ── Admin: announcements ──────────────────────────────────────────────────────

export interface AnnouncementDto {
  id: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  redirectUrl?: string;
  pinned: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export function fetchAdminAnnouncements(): Promise<AnnouncementDto[]> {
  return getJson<AnnouncementDto[]>(`/api/v1/admin/announcements`);
}

export function createAnnouncement(body: {
  title: string;
  bodyMd: string;
  imageUrl?: string;
  redirectUrl?: string;
  pinned?: boolean;
  published?: boolean;
}): Promise<AnnouncementDto> {
  return sendJson("POST", `/api/v1/admin/announcements`, body);
}

export function updateAnnouncement(
  id: string,
  body: { title?: string; bodyMd?: string; imageUrl?: string; redirectUrl?: string; pinned?: boolean; published?: boolean },
): Promise<AnnouncementDto> {
  return sendJson("PATCH", `/api/v1/admin/announcements/${id}`, body);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await fetch(`${typeof window !== "undefined" ? "" : ""}${BASE_URL}/api/v1/admin/announcements/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ── Admin: promo codes ───────────────────────────────────────────────────

export interface PromoCodeDto {
  id: string;
  code: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  maxUses: number;
  usedCount: number;
  competitionId?: string;
  validFrom?: string;
  validTo?: string;
  active: boolean;
  createdAt: string;
}

export function fetchPromoCodes(): Promise<PromoCodeDto[]> {
  return getJson<PromoCodeDto[]>(`/api/v1/admin/promo-codes`);
}

export function createPromoCode(body: {
  code: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  maxUses?: number;
  competitionId?: string;
  validFrom?: string;
  validTo?: string;
}): Promise<PromoCodeDto> {
  return sendJson("POST", `/api/v1/admin/promo-codes`, body);
}

export function updatePromoCode(
  id: string,
  body: Partial<Pick<PromoCodeDto, "code" | "discountType" | "discountValue" | "maxUses" | "competitionId" | "validFrom" | "validTo" | "active">>,
): Promise<PromoCodeDto> {
  return sendJson("PATCH", `/api/v1/admin/promo-codes/${id}`, body);
}

export async function deletePromoCode(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/promo-codes/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export function validatePromoCode(
  code: string,
  competitionId?: string,
): Promise<{ valid: boolean; code: string; discountType: string; discountValue: number }> {
  return sendJson("POST", `/api/v1/promo/validate`, { code, competitionId });
}

// ── Admin: migration ──────────────────────────────────────────────────────────

export interface MigrationStats {
  totalUsers: number;
  activeUsers: number;
  unclaimedStubs: number;
  stubs: Array<{ id: string; clId: string; name: string; email: string; createdAt: string }>;
}

export function fetchMigrationStats(): Promise<MigrationStats> {
  return getJson<MigrationStats>(`/api/v1/admin/migration/stats`);
}

export function sendBulkEmail(
  compId: string,
  body: { subject: string; bodyHtml: string },
): Promise<{ sent: boolean; message: string; recipientCount: number; recipients: string[] }> {
  return sendJson("POST", `/api/v1/admin/competitions/${compId}/email`, body);
}

export async function downloadCertificatesZip(compId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/competitions/${compId}/certificates`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Certificate generation failed: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "certificates.zip";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportCompetitionCSV(compId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/competitions/${compId}/export`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "results.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Appeals ──────────────────────────────────────────────────────────────

export interface AppealDto {
  id: string;
  resultId: string;
  userId: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  adminResponse?: string;
  createdAt: string;
  resolvedAt?: string;
  userName?: string;
  userClId?: string;
  flagStatus?: string;
}

export async function submitAppeal(resultId: string, reason: string): Promise<AppealDto> {
  const res = await fetch(`${BASE_URL}/api/v1/appeals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ resultId, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Appeal failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMyAppeals(): Promise<AppealDto[]> {
  const res = await fetch(`${BASE_URL}/api/v1/me/appeals`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch appeals failed: ${res.status}`);
  return res.json();
}

export async function fetchAllAppeals(): Promise<AppealDto[]> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/appeals`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch appeals failed: ${res.status}`);
  return res.json();
}

export async function resolveAppeal(
  id: string,
  action: "accepted" | "rejected",
  adminResponse?: string,
): Promise<AppealDto> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/appeals/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ action, adminResponse }),
  });
  if (!res.ok) throw new Error(`Resolve failed: ${res.status}`);
  return res.json();
}

// ── WCA verification queue ──────────────────────────────────────────────

export interface WcaQueueUser {
  id: string;
  clId: string;
  name: string;
  email: string;
  wcaId: string;
  wcaVerified: boolean;
}

export async function fetchWcaQueue(): Promise<WcaQueueUser[]> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/wca-queue`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch WCA queue failed: ${res.status}`);
  return res.json();
}

export async function resolveWcaVerification(
  userId: string,
  action: "verify" | "reject",
): Promise<{ id: string; wcaId?: string; wcaVerified: boolean }> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/wca-queue/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`WCA action failed: ${res.status}`);
  return res.json();
}

// ── Rank tiers ──────────────────────────────────────────────────────────

export interface RankTierDto {
  id: string;
  name: string;
  eventType: string;
  maxAo5Ms: number;
  color: string;
  createdAt: string;
}

export async function fetchRankTiers(): Promise<RankTierDto[]> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/rank-tiers`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch rank tiers failed: ${res.status}`);
  return res.json();
}

export async function createRankTier(
  data: { name: string; eventType: string; maxAo5Ms: number; color: string },
): Promise<RankTierDto> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/rank-tiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create tier failed: ${res.status}`);
  return res.json();
}

export async function updateRankTier(
  id: string,
  fields: Partial<Pick<RankTierDto, "name" | "maxAo5Ms" | "color">>,
): Promise<RankTierDto> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/rank-tiers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Update tier failed: ${res.status}`);
  return res.json();
}

export async function deleteRankTier(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/rank-tiers/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete tier failed: ${res.status}`);
}

// ── Account merge ───────────────────────────────────────────────────────

export interface MergeResult {
  kept: { id: string; clId: string; name: string };
  merged: { id: string; clId: string; name: string };
  movedRegistrations: number;
  movedResults: number;
}

export async function mergeAccounts(keepUserId: string, mergeUserId: string): Promise<MergeResult> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/merge-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ keepUserId, mergeUserId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Merge failed: ${res.status}`);
  }
  return res.json();
}

// ── Round notifications ─────────────────────────────────────────────────

export async function sendRoundNotification(
  roundId: string,
): Promise<{ sent: boolean; message: string; recipientCount: number }> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/rounds/${roundId}/notify`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Notify failed: ${res.status}`);
  return res.json();
}

// ── Avatar upload ───────────────────────────────────────────────────────

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append("avatar", file);
  const res = await fetch(`${BASE_URL}/api/v1/users/me/avatar`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// ── Invoice download ────────────────────────────────────────────────────

export async function downloadInvoice(paymentId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}/invoice`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Invoice download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${paymentId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Rankings ────────────────────────────────────────────────────────────────

export interface RankingEntry {
  userId: string;
  clId: string;
  name: string;
  eventType: string;
  bestSingleMs: number | null;
  bestAo5Ms: number | null;
}

export function fetchRankings(event?: string): Promise<RankingEntry[]> {
  const qs = event ? `?event=${encodeURIComponent(event)}` : "";
  return getJson<RankingEntry[]>(`/api/v1/rankings${qs}`);
}

// ── Banners ──────────────────────────────────────────────────────────────

export interface BannerDto {
  id: string;
  title: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  expiresAt?: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export function fetchAdminBanners(): Promise<BannerDto[]> {
  return getJson<BannerDto[]>(`/api/v1/admin/banners`);
}

export function fetchPublicBanners(): Promise<BannerDto[]> {
  return getJson<BannerDto[]>(`/api/v1/banners`);
}

export function createBanner(body: {
  title: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  expiresAt?: string;
  active?: boolean;
  order?: number;
}): Promise<BannerDto> {
  return sendJson("POST", `/api/v1/admin/banners`, body);
}

export function updateBanner(
  id: string,
  body: Partial<Pick<BannerDto, "title" | "imageUrl" | "ctaText" | "ctaLink" | "expiresAt" | "active" | "order">>,
): Promise<BannerDto> {
  return sendJson("PATCH", `/api/v1/admin/banners/${id}`, body);
}

export async function deleteBanner(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/banners/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete banner failed: ${res.status}`);
}

// ── FAQ ──────────────────────────────────────────────────────────────────

export interface FaqDto {
  id: string;
  question: string;
  answerMd: string;
  order: number;
  published: boolean;
  createdAt: string;
}

export function fetchAdminFaq(): Promise<FaqDto[]> {
  return getJson<FaqDto[]>(`/api/v1/admin/faq`);
}

export function fetchPublicFaq(): Promise<FaqDto[]> {
  return getJson<FaqDto[]>(`/api/v1/faq`);
}

export function createFaq(body: {
  question: string;
  answerMd: string;
  order?: number;
  published?: boolean;
}): Promise<FaqDto> {
  return sendJson("POST", `/api/v1/admin/faq`, body);
}

export function updateFaq(
  id: string,
  body: Partial<Pick<FaqDto, "question" | "answerMd" | "order" | "published">>,
): Promise<FaqDto> {
  return sendJson("PATCH", `/api/v1/admin/faq/${id}`, body);
}

export async function deleteFaq(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/faq/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete FAQ failed: ${res.status}`);
}

// ── Content Pages ──────────────────────────────────────────────────────

export interface ContentPageDto {
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
  published: boolean;
  updatedAt: string;
  createdAt: string;
}

export function fetchAdminContentPages(): Promise<ContentPageDto[]> {
  return getJson<ContentPageDto[]>(`/api/v1/admin/content-pages`);
}

export function fetchPublicPage(slug: string): Promise<{ slug: string; title: string; bodyMd: string }> {
  return getJson(`/api/v1/pages/${slug}`);
}

export function createContentPage(body: {
  slug: string;
  title: string;
  bodyMd?: string;
  published?: boolean;
}): Promise<ContentPageDto> {
  return sendJson("POST", `/api/v1/admin/content-pages`, body);
}

export function updateContentPage(
  id: string,
  body: Partial<Pick<ContentPageDto, "slug" | "title" | "bodyMd" | "published">>,
): Promise<ContentPageDto> {
  return sendJson("PATCH", `/api/v1/admin/content-pages/${id}`, body);
}

export async function deleteContentPage(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/content-pages/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete content page failed: ${res.status}`);
}

// ── Staff creation ──────────────────────────────────────────────────────

export function createStaff(body: {
  email: string;
  name: string;
  role: "judge" | "moderator";
}): Promise<{ id: string; clId: string; name: string; email: string; role: string }> {
  return sendJson("POST", `/api/v1/admin/create-staff`, body);
}

// ── Practice Sessions ──────────────────────────────────────────────────

export interface PracticeSessionDto {
  id: string;
  userId: string;
  eventType: string;
  name?: string;
  createdAt: string;
  endedAt?: string;
  solveCount?: number;
}

export interface PracticeSolveDto {
  id: string;
  sessionId: string;
  timeMs: number;
  scramble: string;
  penalty: "none" | "plus2" | "dnf";
  note?: string;
  createdAt: string;
}

export async function fetchPracticeSessions(): Promise<PracticeSessionDto[]> {
  const res = await fetch(`${BASE_URL}/api/v1/practice/sessions`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.sessions ?? [];
}

export async function createPracticeSession(eventType: string, name?: string): Promise<PracticeSessionDto> {
  const data = await sendJson<{ session: PracticeSessionDto }>("POST", "/api/v1/practice/sessions", { eventType, name });
  return data.session;
}

export async function fetchPracticeSession(id: string): Promise<{ session: PracticeSessionDto; solves: PracticeSolveDto[] }> {
  const res = await fetch(`${BASE_URL}/api/v1/practice/sessions/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

export async function updatePracticeSession(id: string, name: string): Promise<PracticeSessionDto> {
  const data = await sendJson<{ session: PracticeSessionDto }>("PATCH", `/api/v1/practice/sessions/${id}`, { name });
  return data.session;
}

export async function deletePracticeSession(id: string): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/practice/sessions/${id}`, { method: "DELETE", headers: authHeaders() });
}

export async function endPracticeSession(id: string): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/practice/sessions/${id}/end`, { method: "POST", headers: authHeaders() });
}

export async function addPracticeSolve(sessionId: string, body: {
  timeMs: number; scramble: string; penalty?: string; note?: string;
}): Promise<PracticeSolveDto> {
  const data = await sendJson<{ solve: PracticeSolveDto }>("POST", `/api/v1/practice/sessions/${sessionId}/solves`, body);
  return data.solve;
}

export async function deletePracticeSolve(id: string): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/practice/solves/${id}`, { method: "DELETE", headers: authHeaders() });
}

// ── Practice Stats ─────────────────────────────────────────────────────

export interface PracticeStatsDto {
  totalSessions: number;
  totalSolves: number;
  totalTimeMs: number;
  eventBests: Record<string, number>;
}

export async function fetchPracticeStats(): Promise<PracticeStatsDto | null> {
  const res = await fetch(`${BASE_URL}/api/v1/practice/stats`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.stats ?? null;
}

// ── Daily Challenge ────────────────────────────────────────────────────

export interface DailyChallengeDto {
  id: string;
  date: string;
  eventType: string;
  scramble: string;
}

export interface DailyChallengeResultDto {
  id: string;
  challengeId: string;
  userId: string;
  timeMs: number;
  submittedAt: string;
  clId?: string;
  name?: string;
}

export interface DailyChallengeResponse {
  challenge: DailyChallengeDto;
  userResult: DailyChallengeResultDto | null;
  streak: number;
  leaderboard: DailyChallengeResultDto[];
}

export async function fetchDailyChallenge(): Promise<DailyChallengeResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/daily-challenge`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch daily challenge");
  return res.json();
}

export async function submitDailyChallenge(timeMs: number): Promise<{ result: DailyChallengeResultDto; streak: number }> {
  return sendJson<{ result: DailyChallengeResultDto; streak: number }>("POST", "/api/v1/daily-challenge/submit", { timeMs });
}
