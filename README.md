# Cubelelo Events Platform

An online speedcubing competition platform built for [Cubelelo](https://cubelelo.com). Competitors register, solve scrambles under timed conditions, and climb the rankings — all in the browser.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Fastify 5, Socket.io (real-time) |
| Database | PostgreSQL (Supabase) / in-memory for dev |
| Auth | Supabase Auth (Google OAuth) + local dev tokens |
| Payments | Razorpay |
| Storage | Cloudflare R2 (falls back to local `uploads/`) |
| Job Queue | BullMQ + Redis (falls back to inline execution) |
| Scrambles | cubing.js (13 WCA events) |
| Email | Resend (falls back to console logging) |
| Testing | Vitest (unit), Playwright (E2E) |
| Monorepo | Turborepo + npm workspaces |

## Project Structure

```
cubers/
├── apps/
│   ├── api/          # Fastify backend (port 4000)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   ├── scramble-core/ # Scramble generation engine
│   ├── timer-core/    # Timer logic
│   ├── types/         # Shared TypeScript types
│   └── database/      # DB migrations & seeds
├── e2e/               # Playwright end-to-end tests
└── project_details/   # PRD, progress tracker, todos
```

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10

No other services are required for local development — the API runs with an in-memory database, local file storage, and console-based email by default.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

All variables are optional for local dev. See [Environment Variables](#environment-variables) for details.

### 3. Start the API

```bash
cd apps/api
DATABASE_URL="" npx tsx watch src/server.ts
```

The API starts on `http://localhost:4000` using the in-memory backend.

### 4. Start the frontend

```bash
cd apps/web
npx next dev -p 3000
```

The app is available at `http://localhost:3000`.

### 5. Dev login

With both servers running, get an admin token:

```bash
curl -X POST http://localhost:4000/api/v1/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cubelelo.com"}'
```

This returns a JWT token. The web app stores it in `localStorage` as `cubers_token`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in dev mode (Turborepo) |
| `npm run build` | Build all apps |
| `npm run typecheck` | Type-check all apps |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Testing

### Unit Tests (Vitest)

```bash
cd apps/api
npm test
```

Runs fast, isolated tests for individual modules (auth, scrambles, timer logic, etc.).

### End-to-End Tests (Playwright)

E2E tests simulate a real user interacting with the app in an actual browser. Playwright opens Chrome, navigates pages, clicks buttons, fills forms, and asserts results — testing the full stack (frontend + API) together.

```bash
# One-time: install the browser
npx playwright install chromium

# Run all E2E tests
npm run test:e2e
```

The Playwright config auto-starts both the API (in-memory, port 4000) and the web app (port 3000) before tests run. No manual server setup needed.

**Test suites:**

| File | Covers |
|------|--------|
| `e2e/auth.spec.ts` | Homepage, login/register pages, auth flows |
| `e2e/competitions.spec.ts` | Competition listing page |
| `e2e/admin.spec.ts` | Admin panel pages, banner & FAQ CRUD |
| `e2e/api-health.spec.ts` | API health endpoint, public endpoints, rate limiting |

## Environment Variables

All variables are optional for local development. The platform gracefully falls back to dev-friendly defaults.

| Variable | Purpose | Fallback |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | In-memory store |
| `REDIS_URL` | Redis for rate limiting & job queue | In-memory rate limiter, inline job execution |
| `SUPABASE_URL` | Supabase project URL | Local dev auth (HS256 tokens) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | Local dev auth |
| `RAZORPAY_KEY_ID` | Razorpay payment key | Payments disabled |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | Payments disabled |
| `RESEND_API_KEY` | Resend email API key | Emails logged to console |
| `R2_ACCOUNT_ID` | Cloudflare R2 account | Local `uploads/` directory |
| `R2_ACCESS_KEY_ID` | R2 access key | Local `uploads/` directory |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | Local `uploads/` directory |
| `R2_BUCKET` | R2 bucket name | Local `uploads/` directory |
| `R2_PUBLIC_URL` | Public URL for R2 assets | Local file paths |

See `.env.example` for the full list with comments.

## Key Features

- **Competition Management** — Create, configure, and run multi-round speedcubing competitions
- **Real-time Lobby & Leaderboard** — Socket.io powered live updates during rounds
- **WCA-compliant Timer** — Web Worker-based timer with inspection mode, +2/DNF penalties
- **13 WCA Events** — Full scramble support via cubing.js
- **Anti-Cheat** — Video verification, statistical outlier detection, submission timing checks
- **User Profiles** — CL IDs, personal bests, competition history, WCA ID linking
- **Admin Panel** — Competition management, user search, role management, content editor, FAQ, announcements
- **Payments** — Razorpay integration with per-event fees, promo codes, GST invoices
- **Dark/Light Theme** — System-aware with manual toggle

## License

Private — Cubelelo.
