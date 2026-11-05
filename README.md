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

## Authentication

[Better Auth](https://www.better-auth.com) with email/password, configured in `src/lib/server/auth.ts`:

- Self sign-up is disabled; users are created with `createUserWithPassword` (seed script, later the admin UI).
- Rate limiting is on in every environment and stored in Postgres (sign-in: 3 tries per 10 s per IP).
  The client IP comes from SvelteKit's `getClientAddress()`; behind a proxy set adapter-node's
  `ADDRESS_HEADER` / `XFF_DEPTH`.
- Password reset links go through `/api/auth/reset-password/:token` and land on `/admin/reset-password`;
  all sessions are revoked on reset.
- Superadmins (`users.is_superadmin`) see every organizer and can create organizers. Create or promote one with
  `npm run user:superadmin -- <email> [name]` (password from `SUPERADMIN_PASSWORD`, otherwise a random one is printed).
- `BETTER_AUTH_SECRET` must be set (`openssl rand -base64 32`).

## Internationalization

[Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs). Messages live in `messages/{locale}.json`
(English is the base locale, German is complete). Use them as `m.key()` from `#lib/paraglide/messages.js`.

- Locale: `PARAGLIDE_LOCALE` cookie (set by the language switcher), else `Accept-Language`, else English.
  A cookie rather than localStorage so server-rendered pages and emails use the right language.
- `src/lib/paraglide` is generated (`npm run i18n:compile`, also run by `npm install`, `check` and the Vite plugin).
- To add a language, add it to `project.inlang/settings.json` and create `messages/<locale>.json`.

## Seat plans

Organizers upload a picture of a venue (PNG/JPEG/WebP, ≤ 5 MB, stored in Postgres). Seats are rotated rectangles in image
pixels. Two ways to annotate a plan:

- **Detect** (plans with drawn seat boxes): click one seat; boxes of similar size are found at any angle
  (`src/lib/seat-detection/boxes.ts`), their numbers read with Tesseract (`ocr.ts`, three readings per box, majority
  vote), and rows found by chaining neighbours, also across aisles and along curves (`rows.ts`). The review lists
  duplicates, gaps and doubtful numbers with fixes suggested from the neighbours (`review.ts`). Users name the rows by
  clicking them in order.
- **Place by hand**: single seats, rows by dragging, renumbering.

Tesseract's worker, core and English model are served by the app itself under `/ocr/` from `node_modules`.
Events pick a plan and assign its seats to their price categories. Uploads need `BODY_SIZE_LIMIT=6M`
(adapter-node's default is 512 KB).

## Configuration

`ORIGIN` is read at **build time** (`paths.origin`) — SvelteKit 3's Node adapter no longer reads it at runtime and otherwise assumes `https`, which breaks form submissions behind plain http.
