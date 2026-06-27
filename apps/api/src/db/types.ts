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
  avatarUrl?: string;
  instagram?: string;
  wcaId?: string;
  wcaVerified: boolean;
  role: UserRole;
  accountStage: AccountStage;
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
  featured: boolean;
  featuredOrder?: number;
  coverCaption?: string;
  createdBy?: string;
  createdAt: string;
}

export interface CompetitionEvent {
  id: string;
  competitionId: string;
  eventType: string;
  roundCount: number;
  cutoffMs?: number;
  timeLimitMs?: number;
}

export interface Round {
  id: string;
  competitionEventId: string;
  roundNumber: number;
  status: RoundStatus;
  advancementCount?: number;
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
  verifiedBy?: string;
  verifiedAt?: string;
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
  submittedAt: string;
}
