# Ticketbox

Multi-tenant event ticketing — SvelteKit (Node adapter), Drizzle, Postgres.

## Getting started

```bash
cp .env.example .env
npm install
npm run db:up        # Postgres (dev + test) and Inbucket via Docker Compose
npm run db:migrate
npm run db:seed      # tenant "demo", user admin@example.com / admin1234
npm run dev          # http://localhost:5180/admin
```

Inbucket (captured emails): http://localhost:9001

## Services and ports

| Service            | Port              |
| ------------------ | ----------------- |
| Dev server         | 5180              |
| E2E server         | 4180              |
| Postgres (dev)     | 54321             |
| Postgres (test)    | 54322 (in-memory) |
| Inbucket web/SMTP  | 9001 / 2501       |

## Tests

```bash
npm run test:integration   # Vitest against the test database + Inbucket
npm run test:e2e           # Playwright against a production build
npm test                   # both
```

Both suites reset the test database (`ticketbox_test`) and apply migrations first.

## Database changes

Edit `src/lib/server/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`.

## Configuration

`ORIGIN` is read at **build time** (`paths.origin`) — SvelteKit 3's Node adapter no longer reads it at runtime and otherwise assumes `https`, which breaks form submissions behind plain http.
