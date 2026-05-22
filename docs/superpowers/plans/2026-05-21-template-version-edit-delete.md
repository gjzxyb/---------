# Template Version Edit Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin users to expand template versions, edit their question snapshot, and delete versions that are not linked to tasks.

**Architecture:** Keep template persistence in server actions and move row expansion into a focused client component. Reuse the existing template question editor for both create and edit flows by adding initial question support and configurable submit text.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Prisma, Server Actions, Zod, Vitest.

---

### Task 1: Validation and Server Actions

**Files:**
- Modify: `lib/evaluation/validation.ts`
- Modify: `app/actions/admin.ts`
- Modify: `tests/admin/validation.test.ts`

- [x] Add schemas for template question updates and delete requests.
- [x] Add `updateEvaluationTemplateQuestions`.
- [x] Add `deleteEvaluationTemplate`, blocked when tasks exist.

### Task 2: Reusable Editor and Version Manager

**Files:**
- Modify: `app/(admin)/admin/templates/TemplateQuestionEditor.tsx`
- Create: `app/(admin)/admin/templates/TemplateVersionManager.tsx`
- Modify: `app/(admin)/admin/templates/page.tsx`

- [x] Allow editor initial questions and custom submit label.
- [x] Render template rows as expandable buttons.
- [x] Expand selected template and show editable questions.
- [x] Render delete action disabled when the template has linked tasks.

### Task 3: Verification

**Files:**
- Test: `tests/admin/validation.test.ts`

- [x] Run focused tests.
- [x] Run TypeScript and lint.
- [x] Verify `/admin/templates` in browser.
