#!/usr/bin/env node
/**
 * Load test: 1K concurrent WebSocket connections + staggered result submissions.
 *
 * Usage:
 *   node scripts/loadtest-1k.mjs --url http://localhost:4000 --round <roundId> --users 1000
 *
 * Prerequisites:
 *   - Server running with DEV_AUTH_SECRET set
 *   - A competition with an open round (roundId)
 *   - Users must be registered + paid for the round's event (Round 1 gate)
 *   - npm i socket.io-client jose  (or run from monorepo root)
 *
 * What it does:
 *   1. Generates N HS256 dev tokens (one per fake user)
 *   2. Connects N Socket.IO clients with auth
 *   3. Each client joins the round room + does lobby:checkin
 *   4. Each client fetches scramble via REST
 *   5. After a staggered delay, each client submits results via REST
 *   6. Listens for lobby:roster and round:leaderboard broadcasts
 *   7. Reports metrics: connect time, submission latency, errors, broadcast counts
 */

import { io as ioClient } from "socket.io-client";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

// ── CLI args ─────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:4000" },
    round: { type: "string" },
    users: { type: "string", default: "1000" },
    secret: { type: "string", default: "dev-secret-change-me-please-32char" },
    rampMs: { type: "string", default: "10000" },
    skipSubmit: { type: "boolean", default: false },
  },
});

const BASE_URL = args.url;
const ROUND_ID = args.round;
const NUM_USERS = parseInt(args.users, 10);
const DEV_SECRET = args.secret;
const RAMP_MS = parseInt(args.rampMs, 10);
const SKIP_SUBMIT = args.skipSubmit;

if (!ROUND_ID) {
  console.error("Error: --round <roundId> is required");
  process.exit(1);
}

console.log(`\n=== Load Test Configuration ===`);
console.log(`  Target:     ${BASE_URL}`);
console.log(`  Round:      ${ROUND_ID}`);
console.log(`  Users:      ${NUM_USERS}`);
console.log(`  Ramp time:  ${RAMP_MS}ms`);
console.log(`  Submit:     ${SKIP_SUBMIT ? "SKIP" : "YES"}`);
console.log();

// ── Token generation ─────────────────────────────────────────────────────────

const secret = new TextEncoder().encode(DEV_SECRET);

async function makeToken(userId, email, name) {
  return new SignJWT({ email, name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

// ── Metrics ──────────────────────────────────────────────────────────────────

const metrics = {
  connectOk: 0,
  connectFail: 0,
  connectTimes: [],
  checkinSent: 0,
  rosterReceived: 0,
  leaderboardReceived: 0,
  scrambleOk: 0,
  scrambleFail: 0,
  scrambleTimes: [],
  submitOk: 0,
  submitFail: 0,
  submitTimes: [],
  submitErrors: {},
  disconnects: 0,
};

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printMetrics() {
  console.log(`\n=== Results ===`);
  console.log(`  Connections:   ${metrics.connectOk} ok / ${metrics.connectFail} failed`);
  if (metrics.connectTimes.length > 0) {
    console.log(`  Connect time:  p50=${percentile(metrics.connectTimes, 50)}ms  p95=${percentile(metrics.connectTimes, 95)}ms  p99=${percentile(metrics.connectTimes, 99)}ms`);
  }
  console.log(`  Checkins sent: ${metrics.checkinSent}`);
  console.log(`  Roster msgs:   ${metrics.rosterReceived}`);
  console.log(`  Leaderboard:   ${metrics.leaderboardReceived}`);
  console.log(`  Scrambles:     ${metrics.scrambleOk} ok / ${metrics.scrambleFail} failed`);
  if (metrics.scrambleTimes.length > 0) {
    console.log(`  Scramble time: p50=${percentile(metrics.scrambleTimes, 50)}ms  p95=${percentile(metrics.scrambleTimes, 95)}ms  p99=${percentile(metrics.scrambleTimes, 99)}ms`);
  }
  console.log(`  Submissions:   ${metrics.submitOk} ok / ${metrics.submitFail} failed`);
  if (metrics.submitTimes.length > 0) {
    console.log(`  Submit time:   p50=${percentile(metrics.submitTimes, 50)}ms  p95=${percentile(metrics.submitTimes, 95)}ms  p99=${percentile(metrics.submitTimes, 99)}ms`);
  }
  if (Object.keys(metrics.submitErrors).length > 0) {
    console.log(`  Submit errors: ${JSON.stringify(metrics.submitErrors)}`);
  }
  console.log(`  Disconnects:   ${metrics.disconnects}`);
  console.log();
}

// ── Generate fake solves ─────────────────────────────────────────────────────

function randomSolves(count = 5) {
  return Array.from({ length: count }, () => ({
    time_ms: 5000 + Math.floor(Math.random() * 25000),
    penalty: "none",
    inspectionPenalty: "none",
  }));
}

// ── Single user lifecycle ────────────────────────────────────────────────────

async function runUser(index) {
  const userId = randomUUID();
  const email = `loadtest-${index}@test.local`;
  const name = `LoadUser${index}`;
  const token = await makeToken(userId, email, name);

  // 1. Connect WebSocket
  const t0 = Date.now();
  const socket = ioClient(BASE_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    timeout: 15000,
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      metrics.connectFail++;
      socket.disconnect();
      resolve({ userId, ok: false, reason: "connect_timeout" });
    }, 20000);

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      metrics.connectFail++;
      resolve({ userId, ok: false, reason: err.message });
    });

    socket.on("disconnect", () => {
      metrics.disconnects++;
    });

    socket.on("lobby:roster", () => {
      metrics.rosterReceived++;
    });

    socket.on("round:leaderboard", () => {
      metrics.leaderboardReceived++;
    });

    socket.on("connect", async () => {
      clearTimeout(timeout);
      metrics.connectOk++;
      metrics.connectTimes.push(Date.now() - t0);

      // 2. Join round room
      socket.emit("join", { roundId: ROUND_ID });

      // 3. Lobby checkin
      socket.emit("lobby:checkin", { roundId: ROUND_ID, name });
      metrics.checkinSent++;

      if (SKIP_SUBMIT) {
        resolve({ userId, ok: true, socket });
        return;
      }

      try {
        // 4. Fetch scramble
        const st0 = Date.now();
        const scrambleRes = await fetch(`${BASE_URL}/api/v1/rounds/${ROUND_ID}/scramble`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        metrics.scrambleTimes.push(Date.now() - st0);

        if (scrambleRes.ok) {
          metrics.scrambleOk++;
        } else {
          metrics.scrambleFail++;
          const body = await scrambleRes.json().catch(() => ({}));
          resolve({ userId, ok: false, reason: `scramble_${scrambleRes.status}`, detail: body });
          return;
        }

        // 5. Wait a bit (simulate solving — stagger submissions)
        const solveDelay = 2000 + Math.random() * 5000;
        await new Promise((r) => setTimeout(r, solveDelay));

        // 6. Submit result
        const sub0 = Date.now();
        const submitRes = await fetch(`${BASE_URL}/api/v1/rounds/${ROUND_ID}/results`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ solves: randomSolves() }),
        });
        metrics.submitTimes.push(Date.now() - sub0);

        if (submitRes.ok) {
          metrics.submitOk++;
        } else {
          metrics.submitFail++;
          const body = await submitRes.json().catch(() => ({}));
          const errKey = body.error || `http_${submitRes.status}`;
          metrics.submitErrors[errKey] = (metrics.submitErrors[errKey] || 0) + 1;
        }

        resolve({ userId, ok: true, socket });
      } catch (err) {
        metrics.submitFail++;
        resolve({ userId, ok: false, reason: err.message });
      }
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Starting ${NUM_USERS} users over ${RAMP_MS}ms ramp...`);

  const staggerMs = RAMP_MS / NUM_USERS;
  const results = [];
  const sockets = [];

  const startTime = Date.now();
  let launched = 0;

  // Progress ticker
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `  [${elapsed}s] launched=${launched}  connected=${metrics.connectOk}  submitted=${metrics.submitOk}  errors=${metrics.connectFail + metrics.submitFail}`
    );
  }, 3000);

  // Launch users with stagger
  const promises = [];
  for (let i = 0; i < NUM_USERS; i++) {
    promises.push(
      (async (idx) => {
        await new Promise((r) => setTimeout(r, idx * staggerMs));
        launched++;
        const result = await runUser(idx);
        results.push(result);
        if (result.socket) sockets.push(result.socket);
      })(i)
    );
  }

  await Promise.all(promises);

  clearInterval(progressInterval);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll ${NUM_USERS} users finished in ${totalTime}s`);

  // Wait a few seconds for remaining broadcasts
  console.log("Waiting 5s for remaining WebSocket broadcasts...");
  await new Promise((r) => setTimeout(r, 5000));

  printMetrics();

  // Cleanup
  console.log("Disconnecting all sockets...");
  for (const s of sockets) {
    s.disconnect();
  }

  // Give sockets a moment to close
  await new Promise((r) => setTimeout(r, 1000));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
