# Smart Teaching Evaluation and Feedback Platform

A Next.js application for course evaluation, teaching feedback, improvement tracking, and administrative reporting. The demo data covers administrator, teacher, student, and analyst workflows so the core product paths can be verified locally.

## Tech Stack

- Next.js 16 with React 19 and App Router
- TypeScript
- Prisma 7 with PostgreSQL
- NextAuth.js
- Tailwind CSS
- Vitest and Testing Library
- ESLint

## Local Setup

Install dependencies:

```bash
npm install
```

Start the local PostgreSQL service:

```bash
docker compose up -d
```

Create local environment variables from the example file:

```bash
cp .env.example .env
```

The default `DATABASE_URL` points to the PostgreSQL container from `docker-compose.yml`.

## Prisma

This project uses Prisma 7. Prisma configuration, including the seed command, lives in `prisma.config.ts`.

Run database migrations:

```bash
npx prisma migrate dev
```

Generate the Prisma client:

```bash
npx prisma generate
```

Seed demo data:

```bash
npx prisma db seed
```

If Docker or PostgreSQL is not available on your machine, database-backed steps such as migrate, seed, and parts of the production build may fail until a reachable database is configured.

## Demo Accounts

All demo accounts use the password `Password123!`.

| Role | Email |
| --- | --- |
| Admin | `admin@example.edu` |
| Teacher | `teacher@example.edu` |
| Student | `student@example.edu` |
| Analyst | `analyst@example.edu` |

## Core Verification Flow

1. Sign in as `student@example.edu` and submit an evaluation from the student evaluation pages.
2. Sign in as `teacher@example.edu` and verify the course list, results pages, small-sample notice, and improvement plan creation.
3. Sign in as `admin@example.edu` and verify the administrative areas:
   - dashboard
   - templates
   - tasks
   - reports
   - base data
   - settings

Teacher result pages hide actual scores, per-question averages, and anonymous comments until there are at least 3 submitted responses for a teaching class. The default seed data has one submitted student response and one pending student response, so submitting as `student@example.edu` brings the sample count to 2 and still triggers small-sample hiding. To verify visible scores and comments, prepare at least 3 submitted responses without changing the default seed script.

## Common Verification Commands

```bash
npm test
npm run lint
npx prisma validate
npx tsc --noEmit
npm run build
```

If `npm run build` fails because `DATABASE_URL` is missing, rerun it with the `DATABASE_URL` from `.env.example`. If PostgreSQL is not running or reachable, DB-dependent build work may remain blocked by the local environment.
