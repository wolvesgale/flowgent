# FlowGent

FlowGent is a Next.js application for managing evangelists, innovators, and meetings. The project uses Prisma with a PostgreSQL
backend and relies on an email/password authentication flow backed by `iron-session`.

## Prerequisites

Create a `.env` file with at least the following secrets:

```bash
SESSION_PASSWORD="your-64-char-secret"
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

> On Vercel, `DATABASE_URL` can point at Prisma Accelerate/Data Proxy for runtime use, while `DIRECT_URL` **must** be a
> direct PostgreSQL connection string used for running migrations. If you only have a single direct connection string, reuse
> it for both variables.

## Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Prisma generates its client automatically on install via the `postinstall` script.

## Authentication

* Login is handled exclusively through `/api/auth/login` using email and password credentials.
* Sessions are stored in an `iron-session` cookie named `flowgent-session` with a 30-day lifetime.
* Use `/api/auth/logout` to invalidate the session cookie.

## CSV Import Notes

The evangelist importer accepts a JSON body with a `rows` array. Import behaviour:

* Each row is processed independently using `Promise.allSettled`, so failures do not abort the batch.
* Rows missing both `firstName` and `lastName` are skipped.
* Deduplication order: `recordId` → `email` → create new record.
* The endpoint responds with `ok`, `total`, `accepted`, `success`, `failed`, and up to the first five `failures` for quick QA.

## Environment Variables

| Environment | `DATABASE_URL` | `DIRECT_URL` |
|-------------|----------------|---------------|
| Local       | Direct PostgreSQL connection string (e.g. `postgresql://postgres:pass@localhost:5432/postgres?schema=public`) | Same value as `DATABASE_URL` |
| Production / Preview (Vercel) | Connection pooling or Prisma Accelerate string (e.g. `prisma://...`) | Direct PostgreSQL connection string (`postgresql://...`, **not** `prisma://`) |

## Deployment on Vercel

1. Set **Build Command** to `npm run vercel-build` in the project settings.
2. Ensure both `DATABASE_URL` and `DIRECT_URL` are configured for the Production/Preview environments. `DIRECT_URL` must be a
   direct connection string (no `prisma://`).
3. Disable Vercel features that inject their own login prompts, such as **Password Protection** or **Preview Protection**. The
   application expects unauthenticated users to reach `/login` directly.

During the Vercel build the script `npm run vercel-build` checks `DIRECT_URL` before running migrations:

* When `DIRECT_URL` is set and not a `prisma://` string, `prisma migrate deploy` runs against that direct connection before
  `next build`.
* When `DIRECT_URL` is missing or points to Prisma Data Proxy, the migration step is skipped and a warning is printed, while
  `next build` continues normally.

## Health Checks

Use `/api/health/db` to verify the deployment environment can reach the database. The endpoint returns `{ ok: true }` on
success and now includes an `evangelistsColumns` array so you can confirm the runtime database exposes the latest schema
columns (e.g. `supportPriority`, `pattern`).

## Useful Commands

```bash
# Run Prisma studio
npx prisma studio

# Apply pending migrations locally
npx prisma migrate deploy

# Generate Prisma client manually
npx prisma generate
```

## Testing the Flow

1. Open `/login` directly to confirm there are no Vercel redirects.
2. Log in with a valid user and confirm the `flowgent-session` cookie is issued.
3. Upload a CSV with 200+ rows; successful rows should appear under `/evangelists` and failures are reported in the API response.
4. Verify select components remain legible in the purple theme.
