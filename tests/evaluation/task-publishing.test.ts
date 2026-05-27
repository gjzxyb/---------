import { describe, expect, it } from "vitest";

import {
  buildAssignmentDrafts,
  formatSubmissionStatusText,
  isTaskVisibleInRecoveryDetail,
  nextRestoredTaskStatus,
  resolveTeachingClassScope,
  selectTeachingClassesForTaskTerm,
  summarizeAssignmentsByStatus,
} from "../../lib/evaluation/task-publishing";

describe("buildAssignmentDrafts", () => {
  it("creates one assignment per selected enrollment and skips existing assignments", () => {
    const drafts = buildAssignmentDrafts({
      enrollments: [
        { studentId: "student-1", teachingClassId: "class-1" },
        { studentId: "student-2", teachingClassId: "class-1" },
        { studentId: "student-3", teachingClassId: "class-2" },
      ],
      existingAssignments: [
        { evaluatorId: "student-1", teachingClassId: "class-1" },
      ],
      teachingClassIds: ["class-1"],
      taskId: "task-1",
    });

    expect(drafts).toEqual([
      {
        evaluatorId: "student-2",
        teachingClassId: "class-1",
        taskId: "task-1",
      },
    ]);
  });

  it("treats an empty class selection as all enrolled classes", () => {
    const drafts = buildAssignmentDrafts({
      enrollments: [
        { studentId: "student-1", teachingClassId: "class-1" },
        { studentId: "student-2", teachingClassId: "class-2" },
      ],
      existingAssignments: [],
      teachingClassIds: [],
      taskId: "task-1",
    });

    expect(drafts).toHaveLength(2);
  });

  it("excludes graduated student enrollments from new assignments", () => {
    const drafts = buildAssignmentDrafts({
      enrollments: [
        { studentId: "student-1", teachingClassId: "class-1", studentStatus: "ACTIVE" },
        { studentId: "student-2", teachingClassId: "class-1", studentStatus: "GRADUATED" },
      ],
      existingAssignments: [],
      teachingClassIds: [],
      taskId: "task-1",
    });

    expect(drafts).toEqual([
      {
        evaluatorId: "student-1",
        teachingClassId: "class-1",
        taskId: "task-1",
      },
    ]);
  });
});

describe("resolveTeachingClassScope", () => {
  const organizations = [
    { id: "school-1", parentId: null },
    { id: "dept-1", parentId: "school-1" },
    { id: "dept-2", parentId: "school-1" },
  ];
  const teachingClasses = [
    { id: "class-1", organizationId: "dept-1" },
    { id: "class-2", organizationId: "dept-2" },
    { id: "class-3", organizationId: null },
  ];

  it("includes classes under selected organization descendants", () => {
    const scope = resolveTeachingClassScope({
      organizations,
      selectedOrganizationIds: ["school-1"],
      selectedTeachingClassIds: [],
      teachingClasses,
    });

    expect(scope).toEqual(["class-1", "class-2"]);
  });

  it("combines explicit classes and organization classes without duplicates", () => {
    const scope = resolveTeachingClassScope({
      organizations,
      selectedOrganizationIds: ["dept-1"],
      selectedTeachingClassIds: ["class-1", "class-3"],
      teachingClasses,
    });

    expect(scope).toEqual(["class-1", "class-3"]);
  });
});

describe("selectTeachingClassesForTaskTerm", () => {
  const teachingClasses = [
    { id: "class-1", term: "2025-2026-1" },
    { id: "class-2", term: "2025-2026-2" },
  ];

  it("uses teaching classes from the exact task term when available", () => {
    expect(
      selectTeachingClassesForTaskTerm(teachingClasses, "2025-2026-2"),
    ).toEqual([{ id: "class-2", term: "2025-2026-2" }]);
  });

  it("falls back to all teaching classes when no exact task term exists", () => {
    expect(
      selectTeachingClassesForTaskTerm(teachingClasses, "2026 春季学期"),
    ).toEqual(teachingClasses);
  });
});

describe("summarizeAssignmentsByStatus", () => {
  it("counts each assignment status and calculates response rate from submitted records", () => {
    const summary = summarizeAssignmentsByStatus([
      { status: "PENDING", response: null, submittedAt: null },
      { status: "IN_PROGRESS", response: { status: "DRAFT" }, submittedAt: null },
      { status: "SUBMITTED", response: { status: "SUBMITTED" }, submittedAt: new Date() },
      { status: "EXPIRED", response: null, submittedAt: null },
    ]);

    expect(summary).toEqual({
      total: 4,
      pending: 1,
      inProgress: 1,
      submitted: 1,
      expired: 1,
      responseRate: 25,
    });
  });
});

describe("formatSubmissionStatusText", () => {
  it("shows pending text instead of an unset date when no submission exists", () => {
    expect(formatSubmissionStatusText(null)).toBe("提交：暂未提交");
  });
});

describe("task list visibility", () => {
  it("shows only draft and open tasks in recovery detail", () => {
    expect(isTaskVisibleInRecoveryDetail("DRAFT")).toBe(true);
    expect(isTaskVisibleInRecoveryDetail("OPEN")).toBe(true);
    expect(isTaskVisibleInRecoveryDetail("CLOSED")).toBe(false);
    expect(isTaskVisibleInRecoveryDetail("ARCHIVED")).toBe(false);
  });

  it("restores archived tasks to closed and closed tasks to open", () => {
    expect(nextRestoredTaskStatus("ARCHIVED")).toBe("CLOSED");
    expect(nextRestoredTaskStatus("CLOSED")).toBe("OPEN");
    expect(nextRestoredTaskStatus("OPEN")).toBeNull();
  });
});
