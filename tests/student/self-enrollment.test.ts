import { describe, expect, it } from "vitest";

import {
  canSelfUnenroll,
  filterAvailableTeachingClasses,
  parseStudentCourseQuery,
  selfEnrollmentSchema,
} from "../../lib/student/self-enrollment";

const teachingClasses = [
  {
    id: "class-1",
    name: "软件工程 1 班",
    term: "2026 春",
    course: { code: "SE101", name: "软件工程" },
    teacher: { name: "王老师" },
  },
  {
    id: "class-2",
    name: "数据结构 2 班",
    term: "2026 春",
    course: { code: "DS101", name: "数据结构" },
    teacher: { name: "李老师" },
  },
  {
    id: "class-3",
    name: "软件工程 3 班",
    term: "2025 秋",
    course: { code: "SE101", name: "软件工程" },
    teacher: { name: "赵老师" },
  },
];

describe("student self enrollment validation", () => {
  it("requires a teaching class id", () => {
    expect(selfEnrollmentSchema.safeParse({ teachingClassId: "" }).success).toBe(
      false,
    );
    expect(
      selfEnrollmentSchema.safeParse({ teachingClassId: "class-1" }).success,
    ).toBe(true);
  });
});

describe("student course query", () => {
  it("parses keyword and term filters", () => {
    expect(parseStudentCourseQuery({ q: " 软件 ", term: "2026 春" })).toEqual({
      q: "软件",
      term: "2026 春",
    });
  });
});

describe("available teaching class filtering", () => {
  it("excludes already enrolled classes and filters by keyword and term", () => {
    const filtered = filterAvailableTeachingClasses(teachingClasses, {
      enrolledTeachingClassIds: new Set(["class-1"]),
      query: { q: "软件", term: "2026 春" },
    });

    expect(filtered.map((item) => item.id)).toEqual([]);
  });

  it("matches course, class, teacher and code text", () => {
    const filtered = filterAvailableTeachingClasses(teachingClasses, {
      enrolledTeachingClassIds: new Set(),
      query: { q: "DS101", term: "" },
    });

    expect(filtered.map((item) => item.id)).toEqual(["class-2"]);
  });
});

describe("self unenrollment policy", () => {
  it("prevents unenrollment when evaluation assignments exist", () => {
    expect(canSelfUnenroll(0)).toBe(true);
    expect(canSelfUnenroll(1)).toBe(false);
  });
});
