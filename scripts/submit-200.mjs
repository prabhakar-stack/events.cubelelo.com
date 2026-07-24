#!/usr/bin/env node
/**
 * Simulate 200 registered users fetching scrambles and submitting results.
 *
 * Reads DEV_AUTH_SECRET from env.
 *
 * Usage:
 *   set DEV_AUTH_SECRET=xxx
 *   node scripts/submit-200.mjs --url <backend> --comp <id> --round <id> [--batch 10]
 */

import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    comp: { type: "string" },
    round: { type: "string" },
    batch: { type: "string", default: "10" },
  },
});

const BASE = args.url;
const COMP_ID = args.comp;
const ROUND_ID = args.round;
const BATCH_SIZE = parseInt(args.batch, 10);
const SECRET = process.env.DEV_AUTH_SECRET;

if (!BASE || !COMP_ID || !SECRET || !ROUND_ID) {
  console.error("Set DEV_AUTH_SECRET env, then:");
  console.error("  node scripts/submit-200.mjs --url <backend> --comp <id> --round <id>");
  process.exit(1);
}

const secretKey = new TextEncoder().encode(SECRET);

async function makeToken(userId, email, name) {
  return new SignJWT({ email, name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey);
}

async function api(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function randomSolves(count = 5) {
  return Array.from({ length: count }, () => {
    const isDnf = Math.random() < 0.05;
    const isPlusTwo = Math.random() < 0.08;
    return {
      time_ms: isDnf ? 0 : (3000 + Math.floor(Math.random() * 57000)),
      penalty: isDnf ? "dnf" : isPlusTwo ? "plus2" : "none",
    };
  });
}

async function main() {
  console.log(`\n=== Submitting results for all registered users ===\n`);

  // Fetch all participants
  console.log("Fetching registered participants...");
  const { status, data } = await api("GET", `/api/v1/competitions/${COMP_ID}/participants`);
  if (status !== 200) {
    console.error("Failed to fetch participants:", data);
    process.exit(1);
  }

  const users = data.participants;
  console.log(`Found ${users.length} registered participants\n`);

  let scrambled = 0, submitted = 0, skipped = 0, errors = 0;
  const startTime = Date.now();
  const errorDetails = {};

  async function submitForUser(user) {
    try {
      const token = await makeToken(user.userId, `${user.clId}@test.cubelelo.com`, user.name);

      // 1. Fetch scramble (records fetch time for anti-cheat)
      const scrambleRes = await api("GET", `/api/v1/rounds/${ROUND_ID}/scramble`, token);
      if (scrambleRes.status === 200) {
        scrambled++;
      } else {
        const errKey = `scramble_${scrambleRes.data?.error || scrambleRes.status}`;
        errorDetails[errKey] = (errorDetails[errKey] || 0) + 1;
        errors++;
        return;
      }

      // 2. Wait a realistic "solving" delay (3-8 seconds)
      const solveDelay = 3000 + Math.floor(Math.random() * 5000);
      await new Promise(r => setTimeout(r, solveDelay));

      // 3. Submit results
      const solves = randomSolves();
      const subRes = await api("POST", `/api/v1/rounds/${ROUND_ID}/results`, token, { solves });
      if (subRes.status === 200 || subRes.status === 201) {
        submitted++;
      } else if (subRes.data?.error === "already_submitted") {
        skipped++;
      } else {
        const errKey = subRes.data?.error || `http_${subRes.status}`;
        errorDetails[errKey] = (errorDetails[errKey] || 0) + 1;
        errors++;
      }
    } catch (err) {
      errorDetails[err.message] = (errorDetails[err.message] || 0) + 1;
      errors++;
    }
  }

  // Process in batches with stagger
  const total = users.length;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(u => submitForUser(u)));

    const done = Math.min(i + BATCH_SIZE, total);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  [${elapsed}s] ${done}/${total} — scrambled:${scrambled} submitted:${submitted} skipped:${skipped} errors:${errors}`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done in ${totalTime}s ===`);
  console.log(`  Scrambled: ${scrambled}`);
  console.log(`  Submitted: ${submitted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  if (Object.keys(errorDetails).length > 0) {
    console.log(`  Error breakdown:`, errorDetails);
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
