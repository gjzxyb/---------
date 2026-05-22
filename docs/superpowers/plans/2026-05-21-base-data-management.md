# Base Data Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split base data into organization, course, student, teacher, teaching class, and enrollment management pages with first-version create/delete/assign workflows.

**Architecture:** Keep `/admin/base-data` as overview and add child App Router pages under `app/(admin)/admin/base-data/*`. Put all mutations in `app/actions/base-data.ts` and all validation in `lib/base-data/validation.ts`.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Server Actions, Zod, Vitest.

---

### Task 1: Validation and Actions

- [x] Add base-data validation schemas.
- [x] Add create/delete actions for organizations, courses, students, teachers, classes, and enrollments.
- [x] Protect deletes when linked records exist.

### Task 2: Navigation and Overview

- [x] Add child menu entries under management center.
- [x] Convert `/admin/base-data` to overview cards with links.

### Task 3: Child Pages

- [x] Create pages for organizations, courses, students, teachers, classes.
- [x] Add forms and lists for each page.
- [x] Add enrollment add/remove controls on classes page.

### Task 4: Verification

- [x] Add validation tests.
- [x] Run focused tests, full tests, TypeScript, and lint.
