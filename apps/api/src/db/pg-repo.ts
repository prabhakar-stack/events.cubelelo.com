import type pg from "pg";
import type { Repository } from "./repo";
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

// ── row → domain type mappers ──────────────────────────────────────────────

type Row = Record<string, unknown>;

function ts(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function toUser(r: Row): User {
  return {
    id: r.id as string,
    clId: r.cl_id as string,
    email: r.email as string,
    name: r.name as string,
    lastName: (r.last_name as string) ?? undefined,
    gender: (r.gender as string) ?? undefined,
    dob: r.dob ? ts(r.dob).slice(0, 10) : undefined,
    mobileNo: (r.mobile_no as string) ?? undefined,
    city: (r.city as string) ?? undefined,
    state: (r.state as string) ?? undefined,
    country: (r.country as string) ?? undefined,
    avatarUrl: (r.avatar_url as string) ?? undefined,
    instagram: (r.instagram as string) ?? undefined,
    wcaId: (r.wca_id as string) ?? undefined,
    wcaVerified: r.wca_verified as boolean,
    role: r.role as User["role"],
    accountStage: r.account_stage as User["accountStage"],
    createdAt: ts(r.created_at),
  };
}

function toComp(r: Row): Competition {
  return {
    id: r.id as string,
    title: r.title as string,
    type: r.type as Competition["type"],
    status: r.status as Competition["status"],
    description: (r.description as string) ?? undefined,
    rulesMd: (r.rules_md as string) ?? undefined,
    baseFee: r.base_fee as number,
    perEventFee: r.per_event_fee as number,
    registrationOpensAt: r.registration_opens_at ? ts(r.registration_opens_at) : undefined,
    registrationDeadline: r.registration_deadline ? ts(r.registration_deadline) : undefined,
    startsAt: r.starts_at ? ts(r.starts_at) : undefined,
    endsAt: r.ends_at ? ts(r.ends_at) : undefined,
    coverUrl: (r.cover_url as string) ?? undefined,
    bannerUrl: (r.banner_url as string) ?? undefined,
    featured: (r.featured as boolean) ?? false,
    featuredOrder: (r.featured_order as number) ?? undefined,
    coverCaption: (r.cover_caption as string) ?? undefined,
    createdBy: (r.created_by as string) ?? undefined,
    createdAt: ts(r.created_at),
  };
}

function toEvent(r: Row): CompetitionEvent {
  return {
    id: r.id as string,
    competitionId: r.competition_id as string,
    eventType: r.event_type as string,
    roundCount: r.round_count as number,
    cutoffMs: (r.cutoff_ms as number) ?? undefined,
    timeLimitMs: (r.time_limit_ms as number) ?? undefined,
  };
}

function toRound(r: Row): Round {
  return {
    id: r.id as string,
    competitionEventId: r.competition_event_id as string,
    roundNumber: r.round_number as number,
    status: r.status as Round["status"],
    advancementCount: (r.advancement_count as number) ?? undefined,
    opensAt: r.opens_at ? ts(r.opens_at) : undefined,
    closesAt: r.closes_at ? ts(r.closes_at) : undefined,
  };
}

function toScrambleSet(r: Row): ScrambleSet {
  return {
    id: r.id as string,
    roundId: r.round_id as string,
    scrambles: r.scrambles_json as string[],
    generatedAt: ts(r.generated_at),
    lockedAt: r.locked_at ? ts(r.locked_at) : undefined,
    lockedBy: (r.locked_by as string) ?? undefined,
  };
}

function toResult(r: Row): Result {
  return {
    id: r.id as string,
    roundId: r.round_id as string,
    userId: r.user_id as string,
    solves: r.solves_json as Result["solves"],
    bestSingleMs: (r.best_single_ms as number) ?? null,
    ao5Ms: (r.ao5_ms as number) ?? null,
    meanMs: (r.mean_ms as number) ?? null,
    medianMs: (r.median_ms as number) ?? null,
    stdMs: (r.std_ms as number) ?? null,
    rank: (r.rank as number) ?? null,
    videoUrl: (r.video_url as string) ?? null,
    flagStatus: r.flag_status as Result["flagStatus"],
    verifiedBy: (r.verified_by as string) ?? undefined,
    verifiedAt: r.verified_at ? ts(r.verified_at) : undefined,
    submittedAt: ts(r.submitted_at),
  };
}

function toRegistration(r: Row): Registration {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    competitionId: r.competition_id as string,
    paymentStatus: r.payment_status as Registration["paymentStatus"],
    createdAt: ts(r.created_at),
  };
}

function toPayment(r: Row): Payment {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    registrationId: r.registration_id as string,
    amount: r.amount as number,
    currency: r.currency as string,
    razorpayOrderId: (r.razorpay_order_id as string) ?? undefined,
    razorpayPaymentId: (r.razorpay_payment_id as string) ?? undefined,
    status: r.status as Payment["status"],
    createdAt: ts(r.created_at),
  };
}

// ── dynamic SET-clause builder ─────────────────────────────────────────────

function buildSet(
  colMap: Record<string, string>,
  fields: Record<string, unknown>,
): { sets: string[]; vals: unknown[]; next: number } {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      sets.push(`${col} = $${i++}`);
      vals.push(fields[key] ?? null);
    }
  }
  return { sets, vals, next: i };
}

// ── PostgreSQL Repository ──────────────────────────────────────────────────

export function createPgRepo(pool: InstanceType<typeof import("pg").Pool>): Repository {
  const roster = new Map<string, Map<string, string>>();

  return {
    // ── users ──────────────────────────────────────────────────────────────
    users: {
      async findAll(search) {
        if (search) {
          const q = `%${search}%`;
          const { rows } = await pool.query(
            "SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR cl_id ILIKE $1 ORDER BY created_at DESC",
            [q],
          );
          return rows.map(toUser);
        }
        const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
        return rows.map(toUser);
      },
      async findById(id) {
        const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        return rows[0] ? toUser(rows[0]) : null;
      },
      async findByEmail(email) {
        const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return rows[0] ? toUser(rows[0]) : null;
      },
      async findByClId(clId) {
        const { rows } = await pool.query("SELECT * FROM users WHERE cl_id = $1", [clId]);
        return rows[0] ? toUser(rows[0]) : null;
      },
      async create(user) {
        await pool.query(
          `INSERT INTO users
             (id, cl_id, email, name, last_name, gender, dob, mobile_no, city, state,
              country, avatar_url, instagram, wca_id, wca_verified, role, account_stage,
              created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)`,
          [
            user.id, user.clId, user.email, user.name,
            user.lastName ?? null, user.gender ?? null, user.dob ?? null,
            user.mobileNo ?? null, user.city ?? null, user.state ?? null,
            user.country ?? null, user.avatarUrl ?? null, user.instagram ?? null,
            user.wcaId ?? null, user.wcaVerified, user.role, user.accountStage,
            user.createdAt,
          ],
        );
      },
      async update(id, fields) {
        const COL: Record<string, string> = {
          name: "name", lastName: "last_name", gender: "gender", dob: "dob",
          mobileNo: "mobile_no", city: "city", state: "state", country: "country",
          avatarUrl: "avatar_url", instagram: "instagram", wcaId: "wca_id",
          wcaVerified: "wca_verified", role: "role", accountStage: "account_stage",
        };
        const { sets, vals, next } = buildSet(COL, fields as Record<string, unknown>);
        if (sets.length === 0) return this.findById(id);
        sets.push(`updated_at = $${next}`);
        vals.push(new Date().toISOString());
        vals.push(id);
        const { rows } = await pool.query(
          `UPDATE users SET ${sets.join(", ")} WHERE id = $${next + 1} RETURNING *`,
          vals,
        );
        return rows[0] ? toUser(rows[0]) : null;
      },
      async nextClId() {
        const year = new Date().getFullYear();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `INSERT INTO cl_id_seq (year, seq) VALUES ($1, 1)
             ON CONFLICT (year) DO UPDATE SET seq = cl_id_seq.seq + 1`,
            [year],
          );
          const { rows } = await client.query(
            "SELECT seq FROM cl_id_seq WHERE year = $1",
            [year],
          );
          await client.query("COMMIT");
          const seq = rows[0].seq as number;
          return `CL-${year}-${String(seq).padStart(4, "0")}`;
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },
    },

    // ── competitions ───────────────────────────────────────────────────────
    competitions: {
      async findAll() {
        const { rows } = await pool.query(
          "SELECT * FROM competitions ORDER BY created_at DESC",
        );
        return rows.map(toComp);
      },
      async findById(id) {
        const { rows } = await pool.query("SELECT * FROM competitions WHERE id = $1", [id]);
        return rows[0] ? toComp(rows[0]) : null;
      },
      async create(comp) {
        await pool.query(
          `INSERT INTO competitions
             (id, title, type, status, cover_url, banner_url, description, rules_md,
              base_fee, per_event_fee, registration_opens_at, registration_deadline,
              starts_at, ends_at, featured, created_by, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)`,
          [
            comp.id, comp.title, comp.type, comp.status,
            comp.coverUrl ?? null, comp.bannerUrl ?? null,
            comp.description ?? null, comp.rulesMd ?? null,
            comp.baseFee, comp.perEventFee,
            comp.registrationOpensAt ?? null, comp.registrationDeadline ?? null,
            comp.startsAt ?? null, comp.endsAt ?? null,
            comp.featured ?? false, comp.createdBy ?? null, comp.createdAt,
          ],
        );
      },
      async update(id, fields) {
        const COL: Record<string, string> = {
          title: "title", status: "status", description: "description",
          rulesMd: "rules_md", baseFee: "base_fee", perEventFee: "per_event_fee",
          registrationOpensAt: "registration_opens_at",
          registrationDeadline: "registration_deadline",
          startsAt: "starts_at", endsAt: "ends_at",
          coverUrl: "cover_url", bannerUrl: "banner_url",
          featured: "featured", featuredOrder: "featured_order", coverCaption: "cover_caption",
        };
        const { sets, vals, next } = buildSet(COL, fields as Record<string, unknown>);
        if (sets.length === 0) return this.findById(id);
        sets.push(`updated_at = $${next}`);
        vals.push(new Date().toISOString());
        vals.push(id);
        const { rows } = await pool.query(
          `UPDATE competitions SET ${sets.join(", ")} WHERE id = $${next + 1} RETURNING *`,
          vals,
        );
        return rows[0] ? toComp(rows[0]) : null;
      },
      async delete(id) {
        await pool.query("DELETE FROM competitions WHERE id = $1", [id]);
      },
      async countRegistrations(compId) {
        const { rows } = await pool.query(
          "SELECT COUNT(*) AS cnt FROM registrations WHERE competition_id = $1",
          [compId],
        );
        return Number(rows[0].cnt);
      },
    },

    // ── competitionEvents ──────────────────────────────────────────────────
    competitionEvents: {
      async findById(id) {
        const { rows } = await pool.query(
          "SELECT * FROM competition_events WHERE id = $1",
          [id],
        );
        return rows[0] ? toEvent(rows[0]) : null;
      },
      async findByCompetition(compId) {
        const { rows } = await pool.query(
          "SELECT * FROM competition_events WHERE competition_id = $1 ORDER BY created_at",
          [compId],
        );
        return rows.map(toEvent);
      },
      async findByRound(roundId) {
        const { rows } = await pool.query(
          `SELECT ce.* FROM competition_events ce
           JOIN rounds r ON r.competition_event_id = ce.id
           WHERE r.id = $1`,
          [roundId],
        );
        return rows[0] ? toEvent(rows[0]) : null;
      },
      async create(event) {
        await pool.query(
          `INSERT INTO competition_events
             (id, competition_id, event_type, round_count, cutoff_ms, time_limit_ms)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            event.id, event.competitionId, event.eventType, event.roundCount,
            event.cutoffMs ?? null, event.timeLimitMs ?? null,
          ],
        );
      },
    },

    // ── rounds ─────────────────────────────────────────────────────────────
    rounds: {
      async findById(id) {
        const { rows } = await pool.query("SELECT * FROM rounds WHERE id = $1", [id]);
        return rows[0] ? toRound(rows[0]) : null;
      },
      async findByCompetition(compId) {
        const { rows } = await pool.query(
          `SELECT r.* FROM rounds r
           JOIN competition_events ce ON ce.id = r.competition_event_id
           WHERE ce.competition_id = $1
           ORDER BY r.round_number`,
          [compId],
        );
        return rows.map(toRound);
      },
      async create(round) {
        await pool.query(
          `INSERT INTO rounds
             (id, competition_event_id, round_number, advancement_count, status, opens_at, closes_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            round.id, round.competitionEventId, round.roundNumber,
            round.advancementCount ?? null, round.status,
            round.opensAt ?? null, round.closesAt ?? null,
          ],
        );
      },
      async update(id, fields) {
        const COL: Record<string, string> = {
          status: "status", opensAt: "opens_at", closesAt: "closes_at",
          advancementCount: "advancement_count",
        };
        const { sets, vals, next } = buildSet(COL, fields as Record<string, unknown>);
        if (sets.length === 0) return this.findById(id);
        vals.push(id);
        const { rows } = await pool.query(
          `UPDATE rounds SET ${sets.join(", ")} WHERE id = $${next} RETURNING *`,
          vals,
        );
        return rows[0] ? toRound(rows[0]) : null;
      },
    },

    // ── scrambleSets ───────────────────────────────────────────────────────
    scrambleSets: {
      async findByRound(roundId) {
        const { rows } = await pool.query(
          "SELECT * FROM scramble_sets WHERE round_id = $1",
          [roundId],
        );
        return rows[0] ? toScrambleSet(rows[0]) : null;
      },
      async upsert(set) {
        await pool.query(
          `INSERT INTO scramble_sets (id, round_id, scrambles_json, generated_at, locked_at, locked_by)
           VALUES ($1,$2,$3::jsonb,$4,$5,$6)
           ON CONFLICT (round_id) DO UPDATE SET
             scrambles_json = EXCLUDED.scrambles_json,
             generated_at   = EXCLUDED.generated_at,
             locked_at      = EXCLUDED.locked_at,
             locked_by      = EXCLUDED.locked_by`,
          [
            set.id, set.roundId, JSON.stringify(set.scrambles),
            set.generatedAt, set.lockedAt ?? null, set.lockedBy ?? null,
          ],
        );
      },
    },

    // ── results ────────────────────────────────────────────────────────────
    results: {
      async findById(id) {
        const { rows } = await pool.query("SELECT * FROM results WHERE id = $1", [id]);
        return rows[0] ? toResult(rows[0]) : null;
      },
      async findByRound(roundId) {
        const { rows } = await pool.query(
          "SELECT * FROM results WHERE round_id = $1",
          [roundId],
        );
        return rows.map(toResult);
      },
      async findByUser(userId) {
        const { rows } = await pool.query(
          "SELECT * FROM results WHERE user_id = $1 ORDER BY submitted_at",
          [userId],
        );
        return rows.map(toResult);
      },
      async create(result) {
        await pool.query(
          `INSERT INTO results
             (id, round_id, user_id, solves_json, best_single_ms, ao5_ms, mean_ms,
              median_ms, std_ms, rank, video_url, flag_status, verified_by, verified_at,
              submitted_at)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            result.id, result.roundId, result.userId,
            JSON.stringify(result.solves),
            result.bestSingleMs, result.ao5Ms, result.meanMs,
            result.medianMs, result.stdMs, result.rank,
            result.videoUrl, result.flagStatus,
            result.verifiedBy ?? null, result.verifiedAt ?? null,
            result.submittedAt,
          ],
        );
      },
      async update(id, fields) {
        const COL: Record<string, string> = {
          flagStatus: "flag_status", verifiedBy: "verified_by", verifiedAt: "verified_at",
          rank: "rank", videoUrl: "video_url",
          bestSingleMs: "best_single_ms", ao5Ms: "ao5_ms",
        };
        const { sets, vals, next } = buildSet(COL, fields as Record<string, unknown>);
        if (sets.length === 0) return this.findById(id);
        vals.push(id);
        const { rows } = await pool.query(
          `UPDATE results SET ${sets.join(", ")} WHERE id = $${next} RETURNING *`,
          vals,
        );
        return rows[0] ? toResult(rows[0]) : null;
      },
      async updateRanks(rankings) {
        if (rankings.length === 0) return;
        // Single query: UPDATE … SET rank = CASE WHEN id=$1 THEN $2 … END
        const cases = rankings
          .map((_, i) => `WHEN id = $${i * 2 + 1}::uuid THEN $${i * 2 + 2}::integer`)
          .join(" ");
        const vals: unknown[] = rankings.flatMap((r) => [r.id, Math.trunc(r.rank)]);
        const ids = rankings.map((r) => r.id);
        vals.push(ids);
        await pool.query(
          `UPDATE results SET rank = CASE ${cases} END WHERE id = ANY($${vals.length}::uuid[])`,
          vals,
        );
      },
    },

    // ── registrations ──────────────────────────────────────────────────────
    registrations: {
      async findById(id) {
        const { rows } = await pool.query("SELECT * FROM registrations WHERE id = $1", [id]);
        return rows[0] ? toRegistration(rows[0]) : null;
      },
      async findByUser(userId) {
        const { rows } = await pool.query(
          "SELECT * FROM registrations WHERE user_id = $1 ORDER BY created_at DESC",
          [userId],
        );
        return rows.map(toRegistration);
      },
      async findByCompetition(compId) {
        const { rows } = await pool.query(
          "SELECT * FROM registrations WHERE competition_id = $1",
          [compId],
        );
        return rows.map(toRegistration);
      },
      async findByUserAndComp(userId, compId) {
        const { rows } = await pool.query(
          "SELECT * FROM registrations WHERE user_id = $1 AND competition_id = $2",
          [userId, compId],
        );
        return rows[0] ? toRegistration(rows[0]) : null;
      },
      async create(reg) {
        await pool.query(
          `INSERT INTO registrations (id, user_id, competition_id, payment_status, created_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [reg.id, reg.userId, reg.competitionId, reg.paymentStatus, reg.createdAt],
        );
      },
      async update(id, fields) {
        if (fields.paymentStatus !== undefined) {
          await pool.query(
            "UPDATE registrations SET payment_status = $1 WHERE id = $2",
            [fields.paymentStatus, id],
          );
        }
      },
      async addEvent(registrationId, competitionEventId) {
        await pool.query(
          `INSERT INTO registration_events (registration_id, competition_event_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [registrationId, competitionEventId],
        );
      },
      async countEvents(registrationId) {
        const { rows } = await pool.query(
          "SELECT COUNT(*) AS cnt FROM registration_events WHERE registration_id = $1",
          [registrationId],
        );
        return Number(rows[0].cnt);
      },
      async findEvents(registrationId) {
        const { rows } = await pool.query(
          `SELECT ce.* FROM competition_events ce
           JOIN registration_events re ON re.competition_event_id = ce.id
           WHERE re.registration_id = $1`,
          [registrationId],
        );
        return rows.map(toEvent);
      },
    },

    // ── payments ───────────────────────────────────────────────────────────
    payments: {
      async findAll() {
        const { rows } = await pool.query("SELECT * FROM payments ORDER BY created_at DESC");
        return rows.map(toPayment);
      },
      async findById(id) {
        const { rows } = await pool.query("SELECT * FROM payments WHERE id = $1", [id]);
        return rows[0] ? toPayment(rows[0]) : null;
      },
      async findByOrderId(orderId) {
        const { rows } = await pool.query(
          "SELECT * FROM payments WHERE razorpay_order_id = $1",
          [orderId],
        );
        return rows[0] ? toPayment(rows[0]) : null;
      },
      async create(payment) {
        await pool.query(
          `INSERT INTO payments
             (id, user_id, registration_id, amount, currency,
              razorpay_order_id, razorpay_payment_id, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
          [
            payment.id, payment.userId, payment.registrationId,
            payment.amount, payment.currency,
            payment.razorpayOrderId ?? null, payment.razorpayPaymentId ?? null,
            payment.status, payment.createdAt,
          ],
        );
      },
      async update(id, fields) {
        const COL: Record<string, string> = {
          razorpayPaymentId: "razorpay_payment_id",
          status: "status",
        };
        const { sets, vals, next } = buildSet(COL, fields as Record<string, unknown>);
        if (sets.length === 0) return;
        sets.push(`updated_at = $${next}`);
        vals.push(new Date().toISOString());
        vals.push(id);
        await pool.query(
          `UPDATE payments SET ${sets.join(", ")} WHERE id = $${next + 1}`,
          vals,
        );
      },
    },

    // ── auditLog ───────────────────────────────────────────────────────────
    auditLog: {
      async create(entry: AuditLogEntry) {
        await pool.query(
          `INSERT INTO audit_log (id, admin_id, action, target, reason, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            entry.id, entry.adminId ?? null, entry.action,
            entry.target ?? null, entry.reason ?? null, entry.createdAt,
          ],
        );
      },
    },

    // ── announcements ──────────────────────────────────────────────────────
    announcements: {
      async findAll(publishedOnly) {
        const { rows } = await pool.query(
          publishedOnly
            ? "SELECT * FROM announcements WHERE published = true ORDER BY pinned DESC, created_at DESC"
            : "SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC",
        );
        return rows.map((r: Row): Announcement => ({
          id: r.id as string, title: r.title as string, bodyMd: r.body_md as string,
          pinned: r.pinned as boolean, published: r.published as boolean,
          createdBy: (r.created_by as string) ?? undefined,
          createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
        }));
      },
      async findById(id) {
        const { rows } = await pool.query("SELECT * FROM announcements WHERE id = $1", [id]);
        if (!rows[0]) return null;
        const r = rows[0] as Row;
        return {
          id: r.id as string, title: r.title as string, bodyMd: r.body_md as string,
          pinned: r.pinned as boolean, published: r.published as boolean,
          createdBy: (r.created_by as string) ?? undefined,
          createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
        };
      },
      async create(a) {
        await pool.query(
          `INSERT INTO announcements (id, title, body_md, pinned, published, created_by, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [a.id, a.title, a.bodyMd, a.pinned, a.published, a.createdBy ?? null, a.createdAt],
        );
      },
      async update(id, fields) {
        const COL: Record<string, string> = {
          title: "title", bodyMd: "body_md", pinned: "pinned", published: "published",
        };
        const { sets, vals, next } = buildSet(COL, fields as Record<string, unknown>);
        if (sets.length === 0) return this.findById(id);
        sets.push(`updated_at = now()`);
        vals.push(id);
        const { rows } = await pool.query(
          `UPDATE announcements SET ${sets.join(", ")} WHERE id = $${next} RETURNING *`,
          vals,
        );
        if (!rows[0]) return null;
        const r = rows[0] as Row;
        return {
          id: r.id as string, title: r.title as string, bodyMd: r.body_md as string,
          pinned: r.pinned as boolean, published: r.published as boolean,
          createdBy: (r.created_by as string) ?? undefined,
          createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
        };
      },
      async delete(id) {
        await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
      },
    },

    // ── advancements ───────────────────────────────────────────────────────
    advancements: {
      async save(roundId, entries) {
        if (entries.length === 0) return;
        await pool.query("DELETE FROM round_advancements WHERE round_id = $1", [roundId]);
        for (const e of entries) {
          await pool.query(
            "INSERT INTO round_advancements (round_id, user_id, rank) VALUES ($1,$2,$3)",
            [e.roundId, e.userId, e.rank],
          );
        }
      },
      async isAdvanced(roundId, userId) {
        const { rows } = await pool.query(
          "SELECT 1 FROM round_advancements WHERE round_id = $1 AND user_id = $2",
          [roundId, userId],
        );
        return rows.length > 0;
      },
      async findByRound(roundId) {
        const { rows } = await pool.query(
          "SELECT * FROM round_advancements WHERE round_id = $1 ORDER BY rank",
          [roundId],
        );
        return rows.map((r: Row): RoundAdvancement => ({
          roundId: r.round_id as string,
          userId: r.user_id as string,
          rank: r.rank as number,
        }));
      },
    },

    // ── personalBests ──────────────────────────────────────────────────────
    personalBests: {
      async findByUser(userId) {
        const { rows } = await pool.query(
          "SELECT * FROM personal_bests WHERE user_id = $1",
          [userId],
        );
        return rows.map((r: Row): PersonalBest => ({
          id: r.id as string,
          userId: r.user_id as string,
          eventType: r.event_type as string,
          bestSingleMs: (r.best_single_ms as number) ?? null,
          bestAo5Ms: (r.best_ao5_ms as number) ?? null,
          bestMeanMs: (r.best_mean_ms as number) ?? null,
          bestMedianMs: (r.best_median_ms as number) ?? null,
          bestRank: (r.best_rank as number) ?? null,
          updatedAt: ts(r.updated_at),
        }));
      },
      async upsert(pb) {
        await pool.query(
          `INSERT INTO personal_bests
             (id, user_id, event_type, best_single_ms, best_ao5_ms, best_mean_ms,
              best_median_ms, best_rank, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
           ON CONFLICT (user_id, event_type) DO UPDATE SET
             best_single_ms = LEAST(EXCLUDED.best_single_ms, personal_bests.best_single_ms),
             best_ao5_ms    = LEAST(EXCLUDED.best_ao5_ms,    personal_bests.best_ao5_ms),
             best_mean_ms   = LEAST(EXCLUDED.best_mean_ms,   personal_bests.best_mean_ms),
             best_median_ms = LEAST(EXCLUDED.best_median_ms, personal_bests.best_median_ms),
             best_rank      = LEAST(EXCLUDED.best_rank,      personal_bests.best_rank),
             updated_at     = now()`,
          [
            pb.id, pb.userId, pb.eventType,
            pb.bestSingleMs, pb.bestAo5Ms, pb.bestMeanMs,
            pb.bestMedianMs, pb.bestRank,
          ],
        );
      },
    },

    // ── practice ───────────────────────────────────────────────────────────
    practice: {
      async createSession(session) {
        await pool.query(
          `INSERT INTO practice_sessions (id, user_id, event_type, name, created_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [session.id, session.userId, session.eventType, session.name ?? null, session.createdAt],
        );
      },
      async findSession(id) {
        const { rows } = await pool.query("SELECT * FROM practice_sessions WHERE id = $1", [id]);
        if (!rows[0]) return null;
        const r = rows[0] as Row;
        return {
          id: r.id as string, userId: r.user_id as string,
          eventType: r.event_type as string, name: (r.name as string) ?? undefined,
          createdAt: ts(r.created_at), endedAt: r.ended_at ? ts(r.ended_at) : undefined,
        } satisfies PracticeSession;
      },
      async findSessionsByUser(userId) {
        const { rows } = await pool.query(
          "SELECT * FROM practice_sessions WHERE user_id = $1 ORDER BY created_at DESC",
          [userId],
        );
        return rows.map((r: Row): PracticeSession => ({
          id: r.id as string, userId: r.user_id as string,
          eventType: r.event_type as string, name: (r.name as string) ?? undefined,
          createdAt: ts(r.created_at), endedAt: r.ended_at ? ts(r.ended_at) : undefined,
        }));
      },
      async endSession(id) {
        await pool.query(
          "UPDATE practice_sessions SET ended_at = now() WHERE id = $1", [id],
        );
      },
      async addSolve(solve) {
        await pool.query(
          `INSERT INTO practice_solves (id, session_id, time_ms, scramble, penalty, note, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            solve.id, solve.sessionId, solve.timeMs, solve.scramble,
            solve.penalty, solve.note ?? null, solve.createdAt,
          ],
        );
      },
      async findSolvesBySession(sessionId) {
        const { rows } = await pool.query(
          "SELECT * FROM practice_solves WHERE session_id = $1 ORDER BY created_at",
          [sessionId],
        );
        return rows.map((r: Row): PracticeSolve => ({
          id: r.id as string, sessionId: r.session_id as string,
          timeMs: r.time_ms as number, scramble: r.scramble as string,
          penalty: r.penalty as PracticeSolve["penalty"],
          note: (r.note as string) ?? undefined, createdAt: ts(r.created_at),
        }));
      },
    },

    // ── dailyChallenge ─────────────────────────────────────────────────────
    dailyChallenge: {
      async findByDate(date) {
        const { rows } = await pool.query(
          "SELECT * FROM daily_challenges WHERE date = $1", [date],
        );
        if (!rows[0]) return null;
        const r = rows[0] as Row;
        return {
          id: r.id as string, date: ts(r.date).slice(0, 10),
          eventType: r.event_type as string, scramble: r.scramble as string,
          createdAt: ts(r.created_at),
        } satisfies DailyChallenge;
      },
      async create(challenge) {
        await pool.query(
          `INSERT INTO daily_challenges (id, date, event_type, scramble, created_at)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (date) DO NOTHING`,
          [challenge.id, challenge.date, challenge.eventType, challenge.scramble, challenge.createdAt],
        );
      },
      async submitResult(result) {
        await pool.query(
          `INSERT INTO daily_challenge_results (id, challenge_id, user_id, time_ms, submitted_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [result.id, result.challengeId, result.userId, result.timeMs, result.submittedAt],
        );
      },
      async findResultByUserAndChallenge(userId, challengeId) {
        const { rows } = await pool.query(
          "SELECT * FROM daily_challenge_results WHERE user_id = $1 AND challenge_id = $2",
          [userId, challengeId],
        );
        if (!rows[0]) return null;
        const r = rows[0] as Row;
        return {
          id: r.id as string, challengeId: r.challenge_id as string,
          userId: r.user_id as string, timeMs: r.time_ms as number,
          submittedAt: ts(r.submitted_at),
        } satisfies DailyChallengeResult;
      },
      async findResultsByChallenge(challengeId) {
        const { rows } = await pool.query(
          `SELECT dcr.*, u.cl_id, u.name FROM daily_challenge_results dcr
           JOIN users u ON u.id = dcr.user_id
           WHERE dcr.challenge_id = $1 ORDER BY dcr.time_ms`,
          [challengeId],
        );
        return rows.map((r: Row): DailyChallengeResult & { clId: string; name: string } => ({
          id: r.id as string, challengeId: r.challenge_id as string,
          userId: r.user_id as string, timeMs: r.time_ms as number,
          submittedAt: ts(r.submitted_at),
          clId: r.cl_id as string, name: r.name as string,
        }));
      },
    },

    async ping() {
      const t0 = Date.now();
      await pool.query("SELECT 1");
      return { backend: "postgresql", latencyMs: Date.now() - t0 };
    },

    // ── roster (always in-memory) ──────────────────────────────────────────
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
