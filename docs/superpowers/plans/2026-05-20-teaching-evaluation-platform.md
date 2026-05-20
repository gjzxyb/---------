# Teaching Evaluation Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable full-stack version of `教学评价与改进平台` with real authentication, role-aware navigation, PostgreSQL persistence, evaluation tasks, responses, statistics, and improvement plans.

**Architecture:** Scaffold a TypeScript Next.js App Router application in the repository root. Use NextAuth credentials login for the first release, Prisma for PostgreSQL persistence, server-side role guards for access control, and small focused server helpers for evaluation aggregation and form actions.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, NextAuth.js, Prisma, PostgreSQL, bcryptjs, zod, Vitest, Testing Library.

---

## File Structure

Create or modify these files:

- `package.json`: scripts and dependencies.
- `next.config.ts`: Next.js configuration.
- `tsconfig.json`: TypeScript configuration.
- `postcss.config.mjs`: Tailwind PostCSS setup.
- `tailwind.config.ts`: Tailwind content paths and theme tokens.
- `.env.example`: required environment variables.
- `docker-compose.yml`: local PostgreSQL service.
- `README.md`: local setup, demo accounts, verification commands.
- `app/globals.css`: base styles and Tailwind layers.
- `app/layout.tsx`: root HTML layout.
- `app/page.tsx`: redirect to login or role dashboard.
- `app/(auth)/login/page.tsx`: login screen.
- `app/(auth)/login/LoginForm.tsx`: client-side login form.
- `app/(portal)/layout.tsx`: authenticated application shell.
- `app/(portal)/dashboard/page.tsx`: role-aware dashboard.
- `app/(portal)/forbidden/page.tsx`: forbidden page.
- `app/(portal)/profile/page.tsx`: current user profile.
- `app/(student)/student/evaluations/page.tsx`: student pending/completed evaluations.
- `app/(student)/student/evaluations/[assignmentId]/page.tsx`: questionnaire page.
- `app/(teacher)/teacher/courses/page.tsx`: teacher course list.
- `app/(teacher)/teacher/results/page.tsx`: teacher result list.
- `app/(teacher)/teacher/results/[teachingClassId]/page.tsx`: class result detail.
- `app/(teacher)/teacher/improvements/page.tsx`: improvement plan list/form.
- `app/(admin)/admin/dashboard/page.tsx`: admin dashboard.
- `app/(admin)/admin/templates/page.tsx`: templates and question bank page.
- `app/(admin)/admin/tasks/page.tsx`: evaluation task management page.
- `app/(admin)/admin/reports/page.tsx`: basic reports page.
- `app/(admin)/admin/base-data/page.tsx`: students, teachers, courses, organizations overview.
- `app/(admin)/admin/settings/page.tsx`: roles and settings overview.
- `app/api/auth/[...nextauth]/route.ts`: NextAuth route.
- `app/actions/evaluations.ts`: server actions for saving and submitting responses.
- `app/actions/improvements.ts`: server actions for improvement plans.
- `components/app-shell.tsx`: sidebar, top bar, and content shell.
- `components/nav.tsx`: role-filtered navigation rendering.
- `components/stat-card.tsx`: compact dashboard metric card.
- `components/data-table.tsx`: basic table wrapper.
- `components/questionnaire.tsx`: questionnaire renderer and submit UI.
- `components/status-badge.tsx`: task/status badge.
- `lib/auth/config.ts`: NextAuth options.
- `lib/auth/guards.ts`: session and role guard helpers.
- `lib/auth/password.ts`: password hashing and verification.
- `lib/db.ts`: Prisma client singleton.
- `lib/evaluation/aggregate.ts`: score, response rate, and comment aggregation.
- `lib/evaluation/validation.ts`: zod schemas for answers and improvement plans.
- `lib/navigation.ts`: full menu tree and role filtering.
- `lib/demo-data.ts`: small formatting helpers for dashboards.
- `prisma/schema.prisma`: PostgreSQL schema.
- `prisma/seed.ts`: demo data and accounts.
- `tests/auth/guards.test.ts`: role guard tests.
- `tests/evaluation/aggregate.test.ts`: aggregation tests.
- `tests/evaluation/validation.test.ts`: response validation tests.
- `tests/navigation.test.ts`: navigation filtering tests.

## Task 1: Scaffold Next.js Application

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`

- [ ] **Step 1: Initialize the project files**

Run:

```powershell
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir false --import-alias "@/*"
```

Expected: Next.js project files are created in the repository root.

- [ ] **Step 2: Install runtime and test dependencies**

Run:

```powershell
npm install next-auth @prisma/client prisma bcryptjs zod
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom tsx @types/bcryptjs
```

Expected: dependencies are added to `package.json`.

- [ ] **Step 3: Add test scripts to `package.json`**

Set the scripts block to include:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts app
git commit -m "chore: scaffold next app"
```

## Task 2: Configure PostgreSQL and Prisma Schema

**Files:**
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`

- [ ] **Step 1: Create local database configuration**

Create `.env.example` with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/teaching_evaluation?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-32-character-secret"
```

Create `docker-compose.yml` with a `postgres:16-alpine` service, database `teaching_evaluation`, user `postgres`, password `postgres`, and host port `5432`.

- [ ] **Step 2: Define Prisma schema**

Create `prisma/schema.prisma` with enums for `Role`, `UserStatus`, `OrgType`, `QuestionType`, `TaskStatus`, `AssignmentStatus`, `ResponseStatus`, `ImprovementStatus`, and models for `User`, `Organization`, `StudentProfile`, `TeacherProfile`, `Course`, `TeachingClass`, `Enrollment`, `QuestionBankItem`, `EvaluationTemplate`, `TemplateQuestion`, `EvaluationTask`, `EvaluationAssignment`, `EvaluationResponse`, `Answer`, `ImprovementPlan`, and `AuditLog`.

Required relationships:

- `User.organizationId -> Organization.id`
- `TeachingClass.courseId -> Course.id`
- `TeachingClass.teacherId -> User.id`
- `Enrollment.studentId -> User.id`
- `EvaluationTask.templateId -> EvaluationTemplate.id`
- `EvaluationAssignment.taskId -> EvaluationTask.id`
- `EvaluationAssignment.evaluatorId -> User.id`
- `EvaluationAssignment.teachingClassId -> TeachingClass.id`
- `EvaluationResponse.assignmentId -> EvaluationAssignment.id`
- `Answer.responseId -> EvaluationResponse.id`
- `Answer.questionId -> TemplateQuestion.id`
- `ImprovementPlan.teacherId -> User.id`
- `ImprovementPlan.teachingClassId -> TeachingClass.id`

- [ ] **Step 3: Add Prisma client singleton**

Create `lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Validate schema**

Run:

```powershell
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 5: Commit database foundation**

Run:

```powershell
git add .env.example docker-compose.yml prisma/schema.prisma lib/db.ts
git commit -m "feat: add prisma data model"
```

## Task 3: Seed Demo Data

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`
- Create: `lib/auth/password.ts`

- [ ] **Step 1: Add password helper**

Create `lib/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 2: Create seed script**

Create `prisma/seed.ts` that:

- Deletes existing rows in dependency order.
- Creates one school, two departments, one class organization.
- Creates users for `admin@example.edu`, `teacher@example.edu`, `student@example.edu`, and `analyst@example.edu` with password `Password123!`.
- Creates one course, one teaching class, one enrollment, five question bank items, one template, one published task, one pending student assignment, one submitted response from another seeded student, and one improvement plan.

- [ ] **Step 3: Configure Prisma seed**

Add this block to `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 4: Run database and seed**

Run:

```powershell
Copy-Item .env.example .env
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
```

Expected: migration succeeds and demo data is inserted.

- [ ] **Step 5: Commit seed data**

Run:

```powershell
git add package.json package-lock.json prisma/seed.ts lib/auth/password.ts prisma/migrations
git commit -m "feat: seed evaluation demo data"
```

## Task 4: Authentication and Role Guards

**Files:**
- Create: `lib/auth/config.ts`
- Create: `lib/auth/guards.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/LoginForm.tsx`
- Create: `app/(portal)/forbidden/page.tsx`
- Create: `tests/auth/guards.test.ts`

- [ ] **Step 1: Write guard tests**

Create tests that verify:

- `hasRole("TEACHER", ["TEACHER"])` returns `true`.
- `hasRole("STUDENT", ["TEACHER"])` returns `false`.
- `canAccessDepartment("SUPER_ADMIN", "dep-a", "dep-b")` returns `true`.
- `canAccessDepartment("DEPARTMENT_ADMIN", "dep-a", "dep-a")` returns `true`.
- `canAccessDepartment("DEPARTMENT_ADMIN", "dep-a", "dep-b")` returns `false`.

- [ ] **Step 2: Implement role guard helpers**

Create `lib/auth/guards.ts` exporting `hasRole`, `canAccessDepartment`, `requireSession`, and `requireRole`. `requireSession` redirects to `/login`; `requireRole` redirects to `/forbidden`.

- [ ] **Step 3: Configure NextAuth credentials login**

Create `lib/auth/config.ts` with a credentials provider that looks up `User.email`, rejects inactive users, verifies passwords with `verifyPassword`, and places `id`, `name`, `email`, `role`, and `organizationId` on the JWT/session.

- [ ] **Step 4: Add auth route and login UI**

Create `app/api/auth/[...nextauth]/route.ts` using `NextAuth(authOptions)`.

Create a login page with username/password fields and demo account hints:

- `admin@example.edu`
- `teacher@example.edu`
- `student@example.edu`
- `analyst@example.edu`

All use `Password123!`.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- tests/auth/guards.test.ts
```

Expected: guard tests pass.

- [ ] **Step 6: Commit authentication**

Run:

```powershell
git add app/api app/(auth) app/(portal)/forbidden lib/auth tests/auth
git commit -m "feat: add credentials authentication"
```

## Task 5: App Shell and Role Navigation

**Files:**
- Create: `lib/navigation.ts`
- Create: `components/app-shell.tsx`
- Create: `components/nav.tsx`
- Create: `components/status-badge.tsx`
- Create: `app/(portal)/layout.tsx`
- Create: `app/(portal)/dashboard/page.tsx`
- Create: `app/(portal)/profile/page.tsx`
- Create: `tests/navigation.test.ts`

- [ ] **Step 1: Write navigation tests**

Create tests that verify:

- A student sees `/student/evaluations` and does not see `/admin/dashboard`.
- A teacher sees `/teacher/results` and does not see `/admin/tasks`.
- A school admin sees `/admin/dashboard`, `/admin/templates`, `/admin/tasks`, and `/admin/reports`.
- Reserved extension items are visible only to admin and analyst roles.

- [ ] **Step 2: Implement menu tree**

Create `lib/navigation.ts` with sections:

- Unified portal: dashboard, profile.
- Student: evaluations.
- Teacher: courses, results, improvements.
- Admin: dashboard, templates, tasks, reports, base data, settings.
- Extensions: supervision, peer review, teacher self-evaluation, parent feedback, classroom observation.

Export `getNavigationForRole(role)`.

- [ ] **Step 3: Implement shell components**

Create a dark left sidebar, compact top bar, role label, and sign-out button. Keep cards at `8px` radius or less.

- [ ] **Step 4: Add authenticated layout and dashboard**

Wrap portal routes with `requireSession`. Dashboard should show role-specific cards and todo counts from Prisma queries.

- [ ] **Step 5: Run tests and lint**

Run:

```powershell
npm test -- tests/navigation.test.ts
npm run lint
```

Expected: tests pass and lint has no errors.

- [ ] **Step 6: Commit navigation shell**

Run:

```powershell
git add app/(portal) components lib/navigation.ts tests/navigation.test.ts
git commit -m "feat: add role aware application shell"
```

## Task 6: Evaluation Validation and Aggregation

**Files:**
- Create: `lib/evaluation/validation.ts`
- Create: `lib/evaluation/aggregate.ts`
- Create: `tests/evaluation/validation.test.ts`
- Create: `tests/evaluation/aggregate.test.ts`

- [ ] **Step 1: Write validation tests**

Test that:

- A scale answer accepts `questionId` and numeric `score` from 1 to 5.
- An open text answer accepts `questionId` and non-empty `text`.
- Submission rejects an empty `answers` array.
- Submission rejects duplicate `questionId` values.

- [ ] **Step 2: Implement zod schemas**

Create schemas:

- `scaleAnswerSchema`
- `textAnswerSchema`
- `evaluationSubmissionSchema`
- `improvementPlanSchema`

Export inferred TypeScript types.

- [ ] **Step 3: Write aggregation tests**

Test:

- `averageScore([5, 4, 3])` returns `4`.
- `responseRate(8, 10)` returns `80`.
- `summarizeQuestionScores` groups scores per question and returns averages.
- `maskComments` removes empty comments and returns only text plus created date.

- [ ] **Step 4: Implement aggregation helpers**

Create pure functions in `lib/evaluation/aggregate.ts` for averages, response rate, question summaries, and comment masking.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- tests/evaluation
```

Expected: validation and aggregation tests pass.

- [ ] **Step 6: Commit evaluation helpers**

Run:

```powershell
git add lib/evaluation tests/evaluation
git commit -m "feat: add evaluation validation and aggregation"
```

## Task 7: Student Evaluation Flow

**Files:**
- Create: `components/questionnaire.tsx`
- Create: `app/actions/evaluations.ts`
- Create: `app/(student)/student/evaluations/page.tsx`
- Create: `app/(student)/student/evaluations/[assignmentId]/page.tsx`

- [ ] **Step 1: Create student list page**

Query assignments for the current student. Show two tables:

- Pending: assignment status `PENDING` or response status `DRAFT`.
- Completed: response status `SUBMITTED`.

Each pending row links to `/student/evaluations/[assignmentId]`.

- [ ] **Step 2: Create questionnaire component**

Render scale questions as radio groups from 1 to 5 and open questions as textareas. Include `Save draft` and `Submit` buttons. Use stable field names: `answers.${questionId}.score` and `answers.${questionId}.text`.

- [ ] **Step 3: Implement server actions**

Create `saveEvaluationDraft(formData)` and `submitEvaluation(formData)` in `app/actions/evaluations.ts`.

Both actions must:

- Require a student session.
- Verify the assignment belongs to the current user.
- Verify the task status is `OPEN`.
- Validate answers with `evaluationSubmissionSchema`.
- Upsert `EvaluationResponse` and `Answer` rows.

`submitEvaluation` additionally sets response status to `SUBMITTED`, assignment status to `SUBMITTED`, and submitted timestamp.

- [ ] **Step 4: Create questionnaire page**

Load assignment, template questions, and existing draft answers. Reject access if assignment does not belong to the current user.

- [ ] **Step 5: Manually verify student flow**

Run:

```powershell
npm run dev
```

Open `http://localhost:3000`, log in as `student@example.edu`, submit a pending evaluation, and confirm it moves to completed.

- [ ] **Step 6: Commit student flow**

Run:

```powershell
git add app/actions/evaluations.ts app/(student) components/questionnaire.tsx
git commit -m "feat: add student evaluation flow"
```

## Task 8: Teacher Result and Improvement Flow

**Files:**
- Create: `app/(teacher)/teacher/courses/page.tsx`
- Create: `app/(teacher)/teacher/results/page.tsx`
- Create: `app/(teacher)/teacher/results/[teachingClassId]/page.tsx`
- Create: `app/(teacher)/teacher/improvements/page.tsx`
- Create: `app/actions/improvements.ts`
- Create: `components/stat-card.tsx`
- Create: `components/data-table.tsx`

- [ ] **Step 1: Create teacher course page**

Query `TeachingClass` rows where `teacherId` is the current user. Show term, course, class name, enrollment count, and task status.

- [ ] **Step 2: Create teacher results page**

Show result cards per teaching class with response count, average score, and result release status. Hide score data if submitted response count is below the small-sample threshold of `3`.

- [ ] **Step 3: Create result detail page**

Display:

- Average score.
- Question-level averages.
- Response distribution by score.
- Anonymized text comments.
- Existing improvement plans for the class.

- [ ] **Step 4: Implement improvement actions**

Create `createImprovementPlan(formData)` and `updateImprovementPlanStatus(formData)`. Validate title, action, deadline, and evidence URL/text with `improvementPlanSchema`. Verify the current teacher owns the teaching class.

- [ ] **Step 5: Create improvement page**

Show teacher improvement plans and a form to create a plan tied to one of the teacher's classes.

- [ ] **Step 6: Manually verify teacher flow**

Log in as `teacher@example.edu`, open results, confirm small-sample behavior, view comments, and create an improvement plan.

- [ ] **Step 7: Commit teacher flow**

Run:

```powershell
git add app/(teacher) app/actions/improvements.ts components/stat-card.tsx components/data-table.tsx
git commit -m "feat: add teacher results and improvements"
```

## Task 9: Administrator Pages

**Files:**
- Create: `app/(admin)/admin/dashboard/page.tsx`
- Create: `app/(admin)/admin/templates/page.tsx`
- Create: `app/(admin)/admin/tasks/page.tsx`
- Create: `app/(admin)/admin/reports/page.tsx`
- Create: `app/(admin)/admin/base-data/page.tsx`
- Create: `app/(admin)/admin/settings/page.tsx`
- Create: `lib/demo-data.ts`

- [ ] **Step 1: Create dashboard**

Show total tasks, total courses, participating students, response rate, low response warnings, and current term trend summary.

- [ ] **Step 2: Create templates page**

Show question bank items, templates, template versions, question types, and active status. The first release can use read-only seeded data with clear table actions disabled when mutation is not implemented.

- [ ] **Step 3: Create tasks page**

Show tasks, time windows, status, assignment count, submitted count, and response rate. Include a read-only "publish control" panel reflecting task status.

- [ ] **Step 4: Create reports page**

Show school, department, teacher, course, and class aggregates computed from submitted responses. Use simple tables and metric cards.

- [ ] **Step 5: Create base data and settings pages**

Base data page shows organizations, students, teachers, courses, teaching classes, and enrollments.

Settings page shows roles, anonymous policy, small-sample threshold, dictionary parameters, and interface configuration as read-only first-release settings.

- [ ] **Step 6: Manually verify admin flow**

Log in as `admin@example.edu`, open each admin page, and verify data renders from PostgreSQL.

- [ ] **Step 7: Commit admin pages**

Run:

```powershell
git add app/(admin) lib/demo-data.ts
git commit -m "feat: add administrator dashboards"
```

## Task 10: Documentation and Final Verification

**Files:**
- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Update README**

Document:

- Tech stack.
- Local PostgreSQL startup with `docker compose up -d`.
- `.env` setup from `.env.example`.
- Prisma migration and seed commands.
- Demo accounts.
- Core verification flows for student, teacher, and admin.

- [ ] **Step 2: Confirm ignored files**

Ensure `.gitignore` includes:

```gitignore
.superpowers/
node_modules/
.next/
.env
.env.local
coverage/
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm test
npm run lint
npx prisma validate
npm run build
```

Expected:

- Tests pass.
- Lint passes.
- Prisma schema is valid.
- Next.js production build succeeds.

- [ ] **Step 4: Browser verification**

With `npm run dev` running, verify:

- `student@example.edu` can submit an evaluation.
- `teacher@example.edu` can view results and create an improvement plan.
- `admin@example.edu` can view dashboard, templates, tasks, reports, base data, and settings.

- [ ] **Step 5: Commit documentation**

Run:

```powershell
git add README.md .gitignore
git commit -m "docs: add setup and verification guide"
```

## Self-Review

Spec coverage:

- Authentication and role routing are covered by Tasks 4 and 5.
- Prisma/PostgreSQL persistence is covered by Tasks 2 and 3.
- Student evaluation submission is covered by Task 7.
- Teacher results, comments, and improvement plans are covered by Task 8.
- Administrator dashboard, templates, tasks, reports, base data, and settings are covered by Task 9.
- Privacy behavior through anonymized comments and small-sample hiding is covered by Tasks 6 and 8.
- Audit logging is included in the schema in Task 2; write events should be added in Tasks 4, 7, 8, and 9 when login, result view, submission, improvement, and admin page actions occur.
- Reserved extension entries are covered by Task 5 navigation.
- Verification is covered by Task 10.

Placeholder scan:

- This plan contains no unresolved markers or unfinished task names.
- Read-only first-release pages are intentionally scoped behavior, not missing implementation.

Type consistency:

- Role names match the design document.
- Evaluation entity names match the file structure and Prisma model list.
- Server action names are consistent across student and teacher tasks.
