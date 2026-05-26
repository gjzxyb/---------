import { describe, expect, it } from "vitest";

import {
  canMaintainTeachingClass,
  courseMatchesStatus,
  getCourseStatusLabel,
  parseTeacherCourseQuery,
  parseTeacherTeachingClassInput,
  summarizeCourseAssignments,
} from "../../lib/teacher/courses";

const openAssignment = {
  status: "PENDING",
  submittedAt: null,
  task: { status: "OPEN", endsAt: new Date("2026-06-01") },
};

const submittedAssignment = {
  status: "SUBMITTED",
  submittedAt: new Date("2026-05-01"),
  task: { status: "CLOSED", endsAt: new Date("2026-05-10") },
};

describe("teacher course query", () => {
  it("parses allowed filters", () => {
    expect(
      parseTeacherCourseQuery({
        q: " 数据 ",
        status: "OPEN_TASK",
        term: "2026 春",
      }),
    ).toEqual({
      q: "数据",
      status: "OPEN_TASK",
      term: "2026 春",
    });
  });

  it("falls back to all status on invalid values", () => {
    expect(parseTeacherCourseQuery({ status: "BAD" }).status).toBe("ALL");
  });
});

describe("teacher course assignment summary", () => {
  it("summarizes submitted, pending, open tasks and response rate", () => {
    const summary = summarizeCourseAssignments([openAssignment, submittedAssignment]);

    expect(summary.submitted).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.openTasks).toBe(1);
    expect(summary.responseRate).toBe(50);
    expect(summary.nextDeadline?.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  it("labels empty, open and completed courses", () => {
    expect(getCourseStatusLabel([])).toBe("暂无任务");
    expect(getCourseStatusLabel([openAssignment])).toBe("收集中");
    expect(getCourseStatusLabel([submittedAssignment])).toBe("已完成");
  });

  it("matches status filters", () => {
    expect(courseMatchesStatus([openAssignment], "OPEN_TASK")).toBe(true);
    expect(courseMatchesStatus([], "NO_TASK")).toBe(true);
    expect(courseMatchesStatus([submittedAssignment], "COMPLETED")).toBe(true);
  });
});

describe("teacher course maintenance", () => {
  it("normalizes teaching class form input", () => {
    expect(
      parseTeacherTeachingClassInput({
        courseId: " course-1 ",
        name: " 软件工程 1 班 ",
        organizationId: "",
        term: " 2026 春 ",
      }),
    ).toEqual({
      courseId: "course-1",
      name: "软件工程 1 班",
      organizationId: undefined,
      term: "2026 春",
    });
  });

  it("allows only current-term classes to be maintained", () => {
    expect(
      canMaintainTeachingClass({
        assignmentCount: 0,
        currentTerm: "2026 春",
        term: "2026 春",
      }),
    ).toEqual({ canChangeCourse: true, canEdit: true });
    expect(
      canMaintainTeachingClass({
        assignmentCount: 3,
        currentTerm: "2026 春",
        term: "2026 春",
      }),
    ).toEqual({ canChangeCourse: false, canEdit: true });
    expect(
      canMaintainTeachingClass({
        assignmentCount: 0,
        currentTerm: "2026 春",
        term: "2025 秋",
      }),
    ).toEqual({ canChangeCourse: false, canEdit: false });
  });
});
