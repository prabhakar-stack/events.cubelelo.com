import type {
  User,
  Competition,
  CompetitionEvent,
  Round,
  ScrambleSet,
  Result,
  Registration,
  Payment,
  AuditLogEntry,
  PersonalBest,
  PracticeSession,
  PracticeSolve,
  DailyChallenge,
  DailyChallengeResult,
  Announcement,
  RoundAdvancement,
} from "./types";

export interface Repository {
  users: {
    findAll(search?: string): Promise<User[]>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByClId(clId: string): Promise<User | null>;
    create(user: User): Promise<void>;
    update(id: string, fields: Partial<User>): Promise<User | null>;
    nextClId(): Promise<string>;
  };

  competitions: {
    findAll(): Promise<Competition[]>;
    findById(id: string): Promise<Competition | null>;
    create(comp: Competition): Promise<void>;
    update(id: string, fields: Partial<Competition>): Promise<Competition | null>;
    delete(id: string): Promise<void>;
    countRegistrations(id: string): Promise<number>;
  };

  competitionEvents: {
    findById(id: string): Promise<CompetitionEvent | null>;
    findByCompetition(compId: string): Promise<CompetitionEvent[]>;
    findByRound(roundId: string): Promise<CompetitionEvent | null>;
    create(event: CompetitionEvent): Promise<void>;
  };

  rounds: {
    findById(id: string): Promise<Round | null>;
    findByCompetition(compId: string): Promise<Round[]>;
    create(round: Round): Promise<void>;
    update(id: string, fields: Partial<Round>): Promise<Round | null>;
  };

  scrambleSets: {
    findByRound(roundId: string): Promise<ScrambleSet | null>;
    upsert(set: ScrambleSet): Promise<void>;
  };

  results: {
    findById(id: string): Promise<Result | null>;
    findByRound(roundId: string): Promise<Result[]>;
    /** userId is the user UUID (users.id). */
    findByUser(userId: string): Promise<Result[]>;
    create(result: Result): Promise<void>;
    update(id: string, fields: Partial<Result>): Promise<Result | null>;
    updateRanks(rankings: { id: string; rank: number }[]): Promise<void>;
  };

  registrations: {
    findById(id: string): Promise<Registration | null>;
    findByUser(userId: string): Promise<Registration[]>;
    findByCompetition(compId: string): Promise<Registration[]>;
    findByUserAndComp(userId: string, compId: string): Promise<Registration | null>;
    create(reg: Registration): Promise<void>;
    update(id: string, fields: Partial<Registration>): Promise<void>;
    addEvent(registrationId: string, competitionEventId: string): Promise<void>;
    countEvents(registrationId: string): Promise<number>;
    findEvents(registrationId: string): Promise<CompetitionEvent[]>;
  };

  payments: {
    findAll(): Promise<Payment[]>;
    findById(id: string): Promise<Payment | null>;
    findByOrderId(orderId: string): Promise<Payment | null>;
    create(payment: Payment): Promise<void>;
    update(id: string, fields: Partial<Payment>): Promise<void>;
  };

  auditLog: {
    create(entry: AuditLogEntry): Promise<void>;
  };

  announcements: {
    findAll(publishedOnly?: boolean): Promise<Announcement[]>;
    findById(id: string): Promise<Announcement | null>;
    create(a: Announcement): Promise<void>;
    update(id: string, fields: Partial<Announcement>): Promise<Announcement | null>;
    delete(id: string): Promise<void>;
  };

  advancements: {
    /** Store shortlisted participants after a round closes. */
    save(roundId: string, entries: RoundAdvancement[]): Promise<void>;
    /** Check if a user was shortlisted for a given round (used to gate round 2+ entry). */
    isAdvanced(roundId: string, userId: string): Promise<boolean>;
    findByRound(roundId: string): Promise<RoundAdvancement[]>;
  };

  personalBests: {
    findByUser(userId: string): Promise<PersonalBest[]>;
    upsert(pb: PersonalBest): Promise<void>;
  };

  practice: {
    createSession(session: PracticeSession): Promise<void>;
    findSession(id: string): Promise<PracticeSession | null>;
    findSessionsByUser(userId: string): Promise<PracticeSession[]>;
    endSession(id: string): Promise<void>;
    addSolve(solve: PracticeSolve): Promise<void>;
    findSolvesBySession(sessionId: string): Promise<PracticeSolve[]>;
  };

  dailyChallenge: {
    findByDate(date: string): Promise<DailyChallenge | null>;
    create(challenge: DailyChallenge): Promise<void>;
    submitResult(result: DailyChallengeResult): Promise<void>;
    findResultByUserAndChallenge(userId: string, challengeId: string): Promise<DailyChallengeResult | null>;
    findResultsByChallenge(challengeId: string): Promise<DailyChallengeResult[]>;
  };

  /** Returns the DB backend name and latency, or null if in-memory. */
  ping(): Promise<{ backend: string; latencyMs: number } | null>;

  /** Ephemeral in-memory roster — always lives in RAM regardless of backend. */
  roster: {
    join(roundId: string, userId: string, name: string): void;
    leave(roundId: string, userId: string): void;
    snapshot(roundId: string): { userId: string; name: string }[];
  };
}
