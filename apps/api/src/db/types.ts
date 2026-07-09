import type {
  CompStatus,
  CompType,
  RoundStatus,
  FlagStatus,
  PaymentStatus,
  AccountStage,
  Solve,
  UserRole,
} from "@cubers/types";

export function sanitizeUser<T extends { passwordHash?: unknown }>(u: T): Omit<T, "passwordHash"> & { hasPassword: boolean } {
  const { passwordHash, ...safe } = u;
  return { ...safe, hasPassword: !!passwordHash };
}

export interface User {
  id: string;
  clId: string;
  email: string;
  name: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  mobileNo?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  landmark?: string;
  pincode?: string;
  avatarUrl?: string;
  instagram?: string;
  wcaId?: string;
  wcaVerified: boolean;
  passwordHash?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  profilePrivacy: "public" | "private";
  role: UserRole;
  accountStage: AccountStage;
  /** Supabase Auth UUID — set on first Google/OAuth sign-in to link the account. */
  supabaseId?: string;
  createdAt: string;
}

export interface Competition {
  id: string;
  title: string;
  type: CompType;
  status: CompStatus;
  description?: string;
  rulesMd?: string;
  baseFee: number;
  perEventFee: number;
  registrationOpensAt?: string;
  registrationDeadline?: string;   // = registration closes at
  startsAt?: string;
  endsAt?: string;
  coverUrl?: string;
  bannerUrl?: string;
  mobileBannerUrl?: string;
  featured: boolean;
  featuredOrder?: number;
  coverCaption?: string;
  cancellationReason?: string;
  videoDeadlineMinutes: number;
  createdBy?: string;
  publishedBy?: string;
  createdAt: string;
}

export interface CompetitionEvent {
  id: string;
  competitionId: string;
  eventType: string;
  roundCount: number;
  cutoffMs?: number;
  timeLimitMs?: number;
  fee?: number;
}

export interface AdvancementCriteria {
  method: "rank" | "time";
  rankLimit?: number;
  timeLimitMs?: number;
}

export interface Round {
  id: string;
  competitionEventId: string;
  roundNumber: number;
  status: RoundStatus;
  advancementCount?: number;
  advancementCriteria?: AdvancementCriteria;
  opensAt?: string;
  closesAt?: string;
  durationMinutes?: number;
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
  verifiedBy?: string;
  verifiedAt?: string;
  verificationComment?: string;
  submittedAt: string;
}

export interface Registration {
  id: string;
  userId: string;
  competitionId: string;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface RegistrationEvent {
  registrationId: string;
  competitionEventId: string;
}

export interface Payment {
  id: string;
  userId: string;
  registrationId: string;
  amount: number;
  currency: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  promoCodeId?: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  target?: string;
  reason?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  redirectUrl?: string;
  pinned: boolean;
  published: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoundAdvancement {
  roundId: string;
  userId: string;
  rank: number;
}

export interface PersonalBest {
  id: string;
  userId: string;
  eventType: string;
  bestSingleMs: number | null;
  bestAo5Ms: number | null;
  bestMeanMs: number | null;
  bestMedianMs: number | null;
  bestRank: number | null;
  updatedAt: string;
}

export interface PracticeSession {
  id: string;
  userId: string;
  eventType: string;
  name?: string;
  createdAt: string;
  endedAt?: string;
}

export interface PracticeSolve {
  id: string;
  sessionId: string;
  timeMs: number;
  scramble: string;
  penalty: "none" | "plus2" | "dnf";
  note?: string;
  createdAt: string;
}

export interface DailyChallenge {
  id: string;
  date: string;
  eventType: string;
  scramble: string;
  createdAt: string;
}

export interface DailyChallengeResult {
  id: string;
  challengeId: string;
  userId: string;
  timeMs: number;
  penalty?: "none" | "plus2" | "dnf";
  submittedAt: string;
}

export interface Appeal {
  id: string;
  resultId: string;
  userId: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  adminResponse?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface RankTier {
  id: string;
  name: string;
  eventType: string;
  maxAo5Ms: number;
  color: string;
  createdAt: string;
}

export interface Banner {
  id: string;
  title: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  linkUrl?: string;
  expiresAt?: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answerMd: string;
  order: number;
  published: boolean;
  createdAt: string;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
  published: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface JudgeAssignment {
  id: string;
  judgeId: string;
  roundId: string;
  assignedBy: string;
  assignedAt: string;
}

export type PromoCodeType = "competition" | "welcome" | "general" | "special";

export interface PromoCode {
  id: string;
  code: string;
  type: PromoCodeType;
  discountType: "percentage" | "flat";
  discountValue: number;
  maxUses: number;
  maxUsesPerUser: number;
  usedCount: number;
  competitionId?: string;
  competitionEventId?: string;
  validFrom?: string;
  validTo?: string;
  active: boolean;
  createdAt: string;
}
