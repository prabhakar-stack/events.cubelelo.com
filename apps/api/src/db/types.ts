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
  registrationDeadline?: string;
  coverUrl?: string;
  bannerUrl?: string;
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
