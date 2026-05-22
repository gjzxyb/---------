# Admin Write Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove first-version read-only blockers from admin template, task, and settings pages by adding scoped create/update flows.

**Architecture:** Add server actions for admin mutations and keep forms colocated in the existing App Router server pages. Persist template/task data in Prisma models; persist system settings in a small JSON file under the workspace so this does not require a schema migration.

**Tech Stack:** Next.js App Router, TypeScript, Server Actions, Prisma, Tailwind CSS, Vitest.

---

### Task 1: Admin Action Layer

**Files:**
- Create: `app/actions/admin.ts`
- Modify: `lib/evaluation/validation.ts`

- [x] Add validation schemas for question items, templates, tasks, task status changes, and settings.
- [x] Implement server actions with `requireRole([...ADMIN_ROLES])`.
- [x] Revalidate `/admin/templates`, `/admin/tasks`, and `/admin/settings` after mutations.

### Task 2: Template Center Writes

**Files:**
- Modify: `app/(admin)/admin/templates/page.tsx`

- [x] Add a new question-bank form.
- [x] Add a new template form that can select existing question-bank items.
- [x] Replace read-only wording and disabled actions with usable controls.

### Task 3: Task Management Writes

**Files:**
- Modify: `app/(admin)/admin/tasks/page.tsx`

- [x] Load active templates for task creation.
- [x] Add a task creation form.
- [x] Add simple status transition controls for publish, close, and archive.

### Task 4: Settings Writes

**Files:**
- Create: `lib/admin/settings-store.ts`
- Modify: `app/(admin)/admin/settings/page.tsx`

- [x] Persist anonymous policy, small-sample threshold, text desensitization, reminder channels, and interface note.
- [x] Replace read-only setting copy with editable forms.

### Task 5: Verification

**Files:**
- Test: `tests/admin/actions.test.ts`

- [x] Add unit coverage for admin validation schemas.
- [x] Run focused tests, lint, and TypeScript checks.
