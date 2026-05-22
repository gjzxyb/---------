# Template Question Editor Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the template question picker editable, removable, manually extendable, and importable from the provided CSV questionnaire format.

**Architecture:** Move the template question selection UI into a focused client component that owns draft rows and sends a JSON snapshot through a hidden field. Keep persistence in the existing admin server action by creating `TemplateQuestion` rows from the submitted snapshot and optionally linking existing question bank items.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Server Actions, Zod, Vitest.

---

### Task 1: Validation and Import Parsing

**Files:**
- Modify: `lib/evaluation/validation.ts`
- Create: `lib/admin/question-import.ts`
- Test: `tests/admin/question-import.test.ts`
- Modify: `tests/admin/validation.test.ts`

- [x] Add `templateQuestionDraftSchema` and update `templateSchema` to accept `questionsJson`.
- [x] Parse CSV headers `分类,题号,题目,分值,题型,选项串`.
- [x] Map `单选` to `SCALE`, text-like question types to `TEXT`.

### Task 2: Client Question Editor

**Files:**
- Create: `app/(admin)/admin/templates/TemplateQuestionEditor.tsx`
- Modify: `app/(admin)/admin/templates/page.tsx`

- [x] Replace static checkbox list with editable rows.
- [x] Support add from question bank, add blank row, delete row, and CSV import.
- [x] Submit current question rows as hidden JSON.

### Task 3: Server Persistence

**Files:**
- Modify: `app/actions/admin.ts`

- [x] Persist template questions from the JSON snapshot.
- [x] Preserve existing question bank links when a row came from the bank.
- [x] Store category and option string in `description`.

### Task 4: Verification

**Files:**
- Test: `tests/admin/question-import.test.ts`

- [x] Run focused tests.
- [x] Run full tests, TypeScript, lint.
- [x] Verify `/admin/templates` in browser.
