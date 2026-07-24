#!/usr/bin/env node
/**
 * Register 200 users and submit results for a competition round.
 *
 * Usage:
 *   node scripts/register-200.mjs --url <backend> --comp <id> --round <id> --count 200
 *
 * Reads DEV_AUTH_SECRET from environment variable.
 */

import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    comp: { type: "string" },
    round: { type: "string" },
    count: { type: "string", default: "200" },
    batch: { type: "string", default: "5" },
  },
});

const BASE = args.url;
const COMP_ID = args.comp;
const ROUND_ID = args.round;
const COUNT = parseInt(args.count, 10);
const BATCH_SIZE = parseInt(args.batch, 10);
const SECRET = process.env.DEV_AUTH_SECRET;

if (!BASE || !COMP_ID || !SECRET || !ROUND_ID) {
  console.error("Usage: DEV_AUTH_SECRET=xxx node scripts/register-200.mjs --url <backend> --comp <id> --round <id> [--count 200] [--batch 5]");
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
  return Array.from({ length: count }, () => ({
    time_ms: 3000 + Math.floor(Math.random() * 57000),
    penalty: "none",
    inspectionPenalty: "none",
  }));
}

async function main() {
  console.log(`\n=== Register ${COUNT} users + submit results ===\n`);

  // Get competition details
  const { data: comp } = await api("GET", `/api/v1/competitions/${COMP_ID}`);
  if (!comp.id) { console.error("Competition not found"); process.exit(1); }
  console.log(`Competition: "${comp.title}"`);
  const eventIds = comp.events?.map(e => e.id) ?? [];
  console.log(`Events: ${comp.events?.map(e => e.eventType).join(", ")}`);
  console.log(`Round: ${ROUND_ID}\n`);

  let created = 0, registered = 0, submitted = 0, errors = 0;
  const startTime = Date.now();

  async function processUser(i) {
    const userId = randomUUID();
    const email = `cuber${i}@test.cubelelo.com`;
    const name = `Cuber ${String(i).padStart(3, "0")}`;

    try {
      const token = await makeToken(userId, email, name);

      // Create user via sync
      const syncRes = await api("POST", "/api/v1/auth/sync", token, {});
      if (syncRes.status === 200 || syncRes.status === 201) {
        created++;
      } else if (syncRes.data?.error === "email_already_registered") {
        return; // skip duplicates
      } else {
        errors++;
        return;
      }

      // Register for competition
      const regRes = await api("POST", `/api/v1/competitions/${COMP_ID}/register`, token, { eventIds });
      if (regRes.status === 201 || regRes.status === 200 || regRes.data?.error === "already_registered") {
        registered++;
      } else {
        if (regRes.data?.error !== "email_not_verified") {
          console.error(`  [${i}] Reg: ${regRes.data?.error}`);
        }
        errors++;
        return;
      }

      // Submit results
      const solves = randomSolves();
      const subRes = await api("POST", `/api/v1/rounds/${ROUND_ID}/results`, token, { solves });
      if (subRes.status === 200 || subRes.status === 201) {
        submitted++;
      } else {
        console.error(`  [${i}] Submit: ${subRes.status} ${subRes.data?.error || JSON.stringify(subRes.data)}`);
        errors++;
      }
    } catch (err) {
      console.error(`  [${i}] ${err.message}`);
      errors++;
    }
  }

  for (let batch = 0; batch < COUNT; batch += BATCH_SIZE) {
    const end = Math.min(batch + BATCH_SIZE, COUNT);
    await Promise.all(
      Array.from({ length: end - batch }, (_, j) => processUser(batch + j))
    );
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  [${elapsed}s] ${end}/${COUNT} — created:${created} reg:${registered} submitted:${submitted} err:${errors}`);
  }

  console.log(`\n=== Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s ===`);
  console.log(`  Created:   ${created}`);
  console.log(`  Registered:${registered}`);
  console.log(`  Submitted: ${submitted}`);
  console.log(`  Errors:    ${errors}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
