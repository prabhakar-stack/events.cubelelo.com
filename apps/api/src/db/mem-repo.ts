import type { Repository } from "./repo";
import type {
  User,
  Competition,
  CompetitionEvent,
  Round,
  ScrambleSet,
  Result,
  Registration,
  RegistrationEvent,
  Payment,
  AuditLogEntry,
  PersonalBest,
  PracticeSession,
  PracticeSolve,
  DailyChallenge,
  DailyChallengeResult,
  Announcement,
  RoundAdvancement,
  PromoCode,
  Appeal,
  RankTier,
  Banner,
  FaqEntry,
  ContentPage,
} from "./types";

/**
 * In-memory Repository — zero dependencies, instant startup.
 * Used when DATABASE_URL is not set (local dev / CI without Postgres).
 * All data is lost on process restart.
 */
export function createMemRepo(): Repository {
  const users = new Map<string, User>();
  const competitions = new Map<string, Competition>();
  const competitionEvents = new Map<string, CompetitionEvent>();
  const rounds = new Map<string, Round>();
  const scrambleSets = new Map<string, ScrambleSet>();
  const results = new Map<string, Result>();
  const registrations = new Map<string, Registration>();
  const registrationEvents: RegistrationEvent[] = [];
  const payments = new Map<string, Payment>();
  const auditLogEntries: AuditLogEntry[] = [];
  const announcements = new Map<string, Announcement>();
  const roundAdvancements = new Map<string, RoundAdvancement[]>();
  const personalBests = new Map<string, PersonalBest>();
  const practiceSessions = new Map<string, PracticeSession>();
  const practiceSolves: PracticeSolve[] = [];
  const dailyChallenges = new Map<string, DailyChallenge>();
  const dailyChallengeResults: DailyChallengeResult[] = [];
  const appeals = new Map<string, Appeal>();
  const rankTiers = new Map<string, RankTier>();
  const promoCodes = new Map<string, PromoCode>();
  const bannerStore = new Map<string, Banner>();
  const faqStore = new Map<string, FaqEntry>();
  const contentPageStore = new Map<string, ContentPage>();
  const roster = new Map<string, Map<string, string>>();
  const clSeq = new Map<number, number>();

  function nextClIdSync(): string {
    const year = new Date().getFullYear();
    const seq = (clSeq.get(year) ?? 0) + 1;
    clSeq.set(year, seq);
    return `CL-${year}-${String(seq).padStart(4, "0")}`;
  }

  return {
    users: {
      async findAll(search) {
        const all = [...users.values()];
        if (!search) return all;
        const q = search.toLowerCase();
        return all.filter(
          (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.clId.toLowerCase().includes(q),
        );
      },
      async findById(id) { return users.get(id) ?? null; },
      async findByEmail(email) {
        return [...users.values()].find((u) => u.email === email) ?? null;
      },
      async findByClId(clId) {
        return [...users.values()].find((u) => u.clId === clId) ?? null;
      },
      async create(user) { users.set(user.id, user); },
      async update(id, fields) {
        const user = users.get(id);
        if (!user) return null;
        Object.assign(user, fields);
        return user;
      },
      async nextClId() { return nextClIdSync(); },
    },

    competitions: {
      async findAll() { return [...competitions.values()]; },
      async findById(id) { return competitions.get(id) ?? null; },
      async create(comp) { competitions.set(comp.id, comp); },
      async update(id, fields) {
        const comp = competitions.get(id);
        if (!comp) return null;
        Object.assign(comp, fields);
        return comp;
      },
      async delete(id) { competitions.delete(id); },
      async countRegistrations(compId) {
        return [...registrations.values()].filter((r) => r.competitionId === compId).length;
      },
    },

    competitionEvents: {
      async findById(id) { return competitionEvents.get(id) ?? null; },
      async findByCompetition(compId) {
        return [...competitionEvents.values()].filter((e) => e.competitionId === compId);
      },
      async findByRound(roundId) {
        const round = rounds.get(roundId);
        if (!round) return null;
        return competitionEvents.get(round.competitionEventId) ?? null;
      },
      async create(event) { competitionEvents.set(event.id, event); },
    },

    rounds: {
      async findById(id) { return rounds.get(id) ?? null; },
      async findByCompetition(compId) {
        const eventIds = new Set(
          [...competitionEvents.values()]
            .filter((e) => e.competitionId === compId)
            .map((e) => e.id),
        );
        return [...rounds.values()].filter((r) => eventIds.has(r.competitionEventId));
      },
      async create(round) { rounds.set(round.id, round); },
      async update(id, fields) {
        const round = rounds.get(id);
        if (!round) return null;
        Object.assign(round, fields);
        return round;
      },
    },

    scrambleSets: {
      async findByRound(roundId) {
        return [...scrambleSets.values()].find((s) => s.roundId === roundId) ?? null;
      },
      async upsert(set) { scrambleSets.set(set.id, set); },
    },

    results: {
      async findById(id) { return results.get(id) ?? null; },
      async findByRound(roundId) {
        return [...results.values()].filter((r) => r.roundId === roundId);
      },
      async findByUser(userId) {
        return [...results.values()].filter((r) => r.userId === userId);
      },
      async create(result) { results.set(result.id, result); },
      async update(id, fields) {
        const result = results.get(id);
        if (!result) return null;
        Object.assign(result, fields);
        return result;
      },
      async updateRanks(rankings) {
        for (const { id, rank } of rankings) {
          const r = results.get(id);
          if (r) r.rank = rank;
        }
      },
    },

    registrations: {
      async findById(id) { return registrations.get(id) ?? null; },
      async findByUser(userId) {
        return [...registrations.values()].filter((r) => r.userId === userId);
      },
      async findByCompetition(compId) {
        return [...registrations.values()].filter((r) => r.competitionId === compId);
      },
      async findByUserAndComp(userId, compId) {
        return (
          [...registrations.values()].find(
            (r) => r.userId === userId && r.competitionId === compId,
          ) ?? null
        );
      },
      async create(reg) { registrations.set(reg.id, reg); },
      async update(id, fields) {
        const reg = registrations.get(id);
        if (reg) Object.assign(reg, fields);
      },
      async addEvent(registrationId, competitionEventId) {
        registrationEvents.push({ registrationId, competitionEventId });
      },
      async countEvents(registrationId) {
        return registrationEvents.filter((re) => re.registrationId === registrationId).length;
      },
      async findEvents(registrationId) {
        const eventIds = registrationEvents
          .filter((re) => re.registrationId === registrationId)
          .map((re) => re.competitionEventId);
        return eventIds
          .map((id) => competitionEvents.get(id))
          .filter((e): e is CompetitionEvent => e !== undefined);
      },
    },

    payments: {
      async findAll() { return [...payments.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
      async findById(id) { return payments.get(id) ?? null; },
      async findByOrderId(orderId) {
        return [...payments.values()].find((p) => p.razorpayOrderId === orderId) ?? null;
      },
      async create(payment) { payments.set(payment.id, payment); },
      async update(id, fields) {
        const payment = payments.get(id);
        if (payment) Object.assign(payment, fields);
      },
    },

    auditLog: {
      async create(entry) { auditLogEntries.push(entry); },
    },

    announcements: {
      async findAll(publishedOnly) {
        const all = [...announcements.values()];
        return publishedOnly ? all.filter((a) => a.published) : all;
      },
      async findById(id) { return announcements.get(id) ?? null; },
      async create(a) { announcements.set(a.id, a); },
      async update(id, fields) {
        const a = announcements.get(id);
        if (!a) return null;
        Object.assign(a, fields);
        return a;
      },
      async delete(id) { announcements.delete(id); },
    },

    advancements: {
      async save(roundId, entries) { roundAdvancements.set(roundId, entries); },
      async isAdvanced(roundId, userId) {
        return (roundAdvancements.get(roundId) ?? []).some((e) => e.userId === userId);
      },
      async findByRound(roundId) { return roundAdvancements.get(roundId) ?? []; },
    },

    personalBests: {
      async findAll() {
        return [...personalBests.values()];
      },
      async findByUser(userId) {
        return [...personalBests.values()].filter((pb) => pb.userId === userId);
      },
      async upsert(pb) {
        const key = `${pb.userId}:${pb.eventType}`;
        personalBests.set(key, pb);
      },
    },

    practice: {
      async createSession(session) { practiceSessions.set(session.id, session); },
      async findSession(id) { return practiceSessions.get(id) ?? null; },
      async findSessionsByUser(userId) {
        return [...practiceSessions.values()]
          .filter((s) => s.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async updateSession(id, fields) {
        const s = practiceSessions.get(id);
        if (!s) return null;
        Object.assign(s, fields);
        return s;
      },
      async deleteSession(id) {
        practiceSessions.delete(id);
        for (let i = practiceSolves.length - 1; i >= 0; i--) {
          if (practiceSolves[i]!.sessionId === id) practiceSolves.splice(i, 1);
        }
      },
      async endSession(id) {
        const s = practiceSessions.get(id);
        if (s) s.endedAt = new Date().toISOString();
      },
      async addSolve(solve) { practiceSolves.push(solve); },
      async findSolvesBySession(sessionId) {
        return practiceSolves.filter((s) => s.sessionId === sessionId);
      },
      async deleteSolve(id) {
        const idx = practiceSolves.findIndex((s) => s.id === id);
        if (idx >= 0) practiceSolves.splice(idx, 1);
      },
    },

    dailyChallenge: {
      async findByDate(date) {
        return [...dailyChallenges.values()].find((c) => c.date === date) ?? null;
      },
      async create(challenge) { dailyChallenges.set(challenge.id, challenge); },
      async submitResult(result) { dailyChallengeResults.push(result); },
      async findResultByUserAndChallenge(userId, challengeId) {
        return dailyChallengeResults.find(
          (r) => r.userId === userId && r.challengeId === challengeId,
        ) ?? null;
      },
      async findResultsByChallenge(challengeId) {
        return dailyChallengeResults.filter((r) => r.challengeId === challengeId);
      },
      async findUserStreak(userId) {
        const userResults = dailyChallengeResults.filter((r) => r.userId === userId);
        if (userResults.length === 0) return 0;
        const dates = new Set<string>();
        for (const r of userResults) {
          const ch = [...dailyChallenges.values()].find((c) => c.id === r.challengeId);
          if (ch) dates.add(ch.date);
        }
        let streak = 0;
        const d = new Date();
        while (true) {
          const dateStr = d.toISOString().slice(0, 10);
          if (dates.has(dateStr)) {
            streak++;
            d.setDate(d.getDate() - 1);
          } else if (streak === 0) {
            d.setDate(d.getDate() - 1);
            if (!dates.has(d.toISOString().slice(0, 10))) break;
          } else {
            break;
          }
        }
        return streak;
      },
    },

    appeals: {
      async findAll() { return [...appeals.values()]; },
      async findById(id) { return appeals.get(id) ?? null; },
      async findByResult(resultId) {
        return [...appeals.values()].find((a) => a.resultId === resultId) ?? null;
      },
      async findByUser(userId) {
        return [...appeals.values()].filter((a) => a.userId === userId);
      },
      async create(appeal) { appeals.set(appeal.id, appeal); },
      async update(id, fields) {
        const existing = appeals.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...fields };
        appeals.set(id, updated);
        return updated;
      },
    },

    rankTiers: {
      async findAll() { return [...rankTiers.values()]; },
      async findById(id) { return rankTiers.get(id) ?? null; },
      async findByEvent(eventType) {
        return [...rankTiers.values()]
          .filter((t) => t.eventType === eventType)
          .sort((a, b) => a.maxAo5Ms - b.maxAo5Ms);
      },
      async create(tier) { rankTiers.set(tier.id, tier); },
      async update(id, fields) {
        const existing = rankTiers.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...fields };
        rankTiers.set(id, updated);
        return updated;
      },
      async delete(id) { rankTiers.delete(id); },
    },

    promoCodes: {
      async findAll() { return [...promoCodes.values()]; },
      async findById(id) { return promoCodes.get(id) ?? null; },
      async findByCode(code) {
        return [...promoCodes.values()].find((p) => p.code.toUpperCase() === code.toUpperCase()) ?? null;
      },
      async create(promo) { promoCodes.set(promo.id, promo); },
      async update(id, fields) {
        const existing = promoCodes.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...fields };
        promoCodes.set(id, updated);
        return updated;
      },
      async delete(id) { promoCodes.delete(id); },
      async incrementUsed(id) {
        const existing = promoCodes.get(id);
        if (existing) promoCodes.set(id, { ...existing, usedCount: existing.usedCount + 1 });
      },
    },

    banners: {
      async findAll() {
        return [...bannerStore.values()].sort((a, b) => a.order - b.order);
      },
      async findById(id) { return bannerStore.get(id) ?? null; },
      async create(banner) { bannerStore.set(banner.id, banner); },
      async update(id, fields) {
        const existing = bannerStore.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...fields };
        bannerStore.set(id, updated);
        return updated;
      },
      async delete(id) { bannerStore.delete(id); },
    },

    faq: {
      async findAll(publishedOnly) {
        const all = [...faqStore.values()].sort((a, b) => a.order - b.order);
        return publishedOnly ? all.filter((f) => f.published) : all;
      },
      async findById(id) { return faqStore.get(id) ?? null; },
      async create(entry) { faqStore.set(entry.id, entry); },
      async update(id, fields) {
        const existing = faqStore.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...fields };
        faqStore.set(id, updated);
        return updated;
      },
      async delete(id) { faqStore.delete(id); },
    },

    contentPages: {
      async findAll(publishedOnly) {
        const all = [...contentPageStore.values()].sort((a, b) => a.title.localeCompare(b.title));
        return publishedOnly ? all.filter((p) => p.published) : all;
      },
      async findBySlug(slug) {
        return [...contentPageStore.values()].find((p) => p.slug === slug) ?? null;
      },
      async findById(id) { return contentPageStore.get(id) ?? null; },
      async create(page) { contentPageStore.set(page.id, page); },
      async update(id, fields) {
        const existing = contentPageStore.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...fields, updatedAt: new Date().toISOString() };
        contentPageStore.set(id, updated);
        return updated;
      },
      async delete(id) { contentPageStore.delete(id); },
    },

    async ping() { return null; },

    roster: {
      join(roundId, userId, name) {
        if (!roster.has(roundId)) roster.set(roundId, new Map());
        roster.get(roundId)!.set(userId, name);
      },
      leave(roundId, userId) {
        roster.get(roundId)?.delete(userId);
      },
      snapshot(roundId) {
        const r = roster.get(roundId);
        if (!r) return [];
        return [...r.entries()].map(([userId, name]) => ({ userId, name }));
      },
    },
  };
}
