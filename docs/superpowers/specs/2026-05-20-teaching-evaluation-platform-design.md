# Teaching Evaluation and Improvement Platform Design

## Goal

Build a full-stack foundation for a smart teaching evaluation and feedback platform using Next.js, Tailwind CSS, NextAuth.js, Prisma, and PostgreSQL. The first release prioritizes real accounts, role-based access, course data, evaluation templates, evaluation tasks, survey responses, statistics, and improvement plans.

The product name used in the UI is `教学评价与改进平台`.

## Confirmed Scope

The first release follows the "core closed loop first" approach.

In scope:

- Password-based login with NextAuth.js and role-aware routing.
- Role-specific entry points for student, teacher, and administrator users.
- Student evaluation workflow: view pending tasks, fill a questionnaire, save/submit responses, view completed records.
- Teacher result workflow: view assigned courses, current evaluation summary, score breakdown, anonymized text comments, and improvement plans.
- Administrator workflow: dashboard, question bank, template management, task publishing, response monitoring, basic reports, base data, and role management.
- Prisma data model and PostgreSQL persistence for users, roles, organizations, courses, classes, enrollments, templates, questions, tasks, responses, answers, improvement plans, and audit logs.
- Seed data for a runnable local demo covering all core roles.
- Reserved navigation and data extension points for supervision evaluation, peer review, teacher self-evaluation, parent feedback, and classroom observation.

Out of scope for the first release:

- Enterprise SSO integrations such as CAS, LDAP, OAuth2 school portal, and unified identity sync.
- Real SMS, email, WeCom, or DingTalk delivery.
- Advanced text governance such as sensitive word workflows, clustering, attribution analysis, and personal information redaction beyond basic display masking.
- Complex warning models and advanced analytics.
- Full-featured PDF/Excel report designer.
- Production-grade data synchronization with educational administration, LMS, student affairs, or portal systems.

## Architecture

The application will use the Next.js App Router. Server-rendered pages and server actions/API handlers will access Prisma through a shared database client. Authentication will be handled by NextAuth.js with a credentials provider for the first release. Authorization will be enforced through server-side session checks and reusable role guards.

High-level components:

- `app/(auth)` contains login and authentication pages.
- `app/(portal)` contains authenticated layout, role-aware navigation, dashboard, and shared portal pages.
- `app/(student)` contains student evaluation pages.
- `app/(teacher)` contains teacher result and improvement pages.
- `app/(admin)` contains management pages.
- `components` contains shared shell, navigation, tables, forms, charts, status badges, and questionnaire widgets.
- `lib/auth` contains NextAuth configuration and role helpers.
- `lib/db` contains the Prisma client.
- `lib/navigation` contains the menu tree and role-based filtering.
- `lib/evaluation` contains reusable evaluation statistics and response aggregation functions.
- `prisma/schema.prisma` defines the database model.
- `prisma/seed.ts` creates demo users, organizations, courses, templates, tasks, responses, and reports.

## UI Structure

The UI uses a management-system layout: a dark left sidebar, a compact top bar, and dense content areas optimized for scanning and repeated work. The platform will not use a marketing landing page.

Real business pages in the first release:

- Unified portal: login, todo center, message list placeholder, personal center.
- Student: pending evaluations, questionnaire fill page, submitted evaluations, basic profile.
- Teacher: assigned courses, evaluation results, historical trend summary, text comments, improvement plans.
- Admin: dashboard, question bank, templates, evaluation tasks, reports, students, teachers, courses/classes, organizations, messages, improvement loop, import/export placeholder, audit logs, system settings.

Reserved entries:

- Supervision evaluation.
- Peer review.
- Teacher self-evaluation.
- Parent feedback.
- Classroom observation.

Reserved entries will be visible as navigation items or simple empty-state pages, but the first release will not implement their full workflows.

## Roles and Authorization

Initial roles:

- `SUPER_ADMIN`
- `SCHOOL_ADMIN`
- `DEPARTMENT_ADMIN`
- `TEACHER`
- `STUDENT`
- `ANALYST`

Authorization rules:

- Super administrators can access all data and settings.
- School administrators can manage school-wide evaluation data.
- Department administrators can manage data scoped to their department.
- Teachers can view their own courses, results, comments, and improvement plans.
- Students can submit their own evaluation tasks and view their own submitted records.
- Analysts can read authorized reports and anonymized comments.

The first release will implement coarse role guards and department ownership checks for key queries. Fine-grained field permissions and export approvals are reserved for later.

## Data Model

Core entities:

- `User`: account, name, email, password hash, role, organization, status.
- `Organization`: school, campus, department, major, class hierarchy.
- `StudentProfile` and `TeacherProfile`: role-specific profile data.
- `Course`: course code, name, type, owning department.
- `TeachingClass`: course offering, term, teacher, student enrollments.
- `Enrollment`: student membership in a teaching class.
- `QuestionBankItem`: reusable questions with type, tags, scale settings, and default score rules.
- `EvaluationTemplate`: versioned questionnaire template.
- `TemplateQuestion`: ordered questions attached to a template.
- `EvaluationTask`: published evaluation task with term, evaluator role, target type, time window, status, and release settings.
- `EvaluationAssignment`: concrete evaluator-to-target assignment for a task.
- `EvaluationResponse`: response header with assignment, status, timestamps, and anonymity snapshot.
- `Answer`: per-question score, option, or open text answer.
- `ImprovementPlan`: teacher-side improvement action, deadline, evidence, status, and review feedback.
- `AuditLog`: login, export, result viewing, and configuration change events.

The model separates evaluator, target, template, task, assignment, response, and answer. This keeps student evaluation reusable for future supervision evaluation, peer review, and teacher self-evaluation.

## Core Flows

Student evaluation:

1. Student logs in.
2. Student sees pending assignments filtered by active task time windows.
3. Student opens the questionnaire generated from the task template.
4. Student saves a draft or submits the response.
5. The submitted response is locked and appears in completed records.

Teacher result review:

1. Teacher logs in.
2. Teacher sees assigned teaching classes and published result summaries.
3. Teacher opens a course result page.
4. The page shows average score, question-level score, distribution, response count, and anonymized text comments.
5. Teacher creates or updates an improvement plan when needed.

Administrator task workflow:

1. Administrator creates question bank items.
2. Administrator builds a template and publishes a version.
3. Administrator creates an evaluation task for a term and teaching-class scope.
4. The system generates assignments from enrollments.
5. Administrator monitors response rate and closes or publishes results.
6. Reports aggregate school, department, teacher, course, and class-level metrics.

## Error Handling

- Unauthenticated users are redirected to login.
- Authenticated users without a required role receive a clear forbidden page.
- Form validation uses schema validation on the server before database writes.
- Evaluation submission validates that the assignment belongs to the user, the task is open, and the response has not already been submitted.
- Published result pages hide data when response counts are below the configured small-sample threshold.
- Database errors are logged server-side and shown as concise user-facing messages.

## Privacy and Audit

The first release will separate identity and response display at the UI/query level. Teachers and analysts see aggregated statistics and anonymized comments, not student identities. Small-sample hiding will prevent result display when the configured threshold is not met.

Audit logs will record authentication events, result viewing, export attempts, and administrative configuration changes. Full export approval and watermarking are reserved for later.

## Testing and Verification

Planned verification:

- Type checking and linting for the Next.js project.
- Prisma schema validation and migration generation.
- Seed script verification against PostgreSQL.
- Unit tests for role helpers, navigation filtering, response validation, and score aggregation.
- Manual browser verification for the three core flows: student submission, teacher result viewing, and administrator task monitoring.

## Implementation Notes

Use conservative dependencies:

- Next.js with TypeScript.
- Tailwind CSS for styling.
- NextAuth.js with Prisma adapter where compatible with the selected NextAuth version.
- Prisma for PostgreSQL schema and queries.
- A small charting library only if the project scaffold supports it cleanly; otherwise use simple CSS/HTML summaries in the first release.

The initial repository is empty except for Git metadata, so the implementation plan will include project scaffolding, dependency installation, database setup documentation, and seed data.
