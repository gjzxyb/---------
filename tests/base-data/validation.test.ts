import { describe, expect, it } from "vitest";

import {
  courseSchema,
  enrollmentSchema,
  idsSchema,
  organizationSchema,
  studentSchema,
  teacherSchema,
  teachingClassSchema,
} from "../../lib/base-data/validation";

describe("base data validation", () => {
  it("normalizes organization input", () => {
    expect(
      organizationSchema.parse({
        name: " 信息工程学院 ",
        type: "DEPARTMENT",
        parentId: "",
      }),
    ).toEqual({
      name: "信息工程学院",
      type: "DEPARTMENT",
      parentId: undefined,
    });
  });

  it("accepts course input", () => {
    expect(
      courseSchema.parse({
        code: "CS101",
        name: "程序设计基础",
        organizationId: "org-1",
      }),
    ).toMatchObject({ code: "CS101", name: "程序设计基础" });
  });

  it("accepts student and teacher profile input", () => {
    expect(
      studentSchema.parse({
        name: "张三",
        email: "student@example.com",
        organizationId: "org-1",
        studentNo: "S001",
        grade: "2026",
        major: "计算机科学",
        status: "ACTIVE",
      }).studentNo,
    ).toBe("S001");

    expect(
      teacherSchema.parse({
        name: "李老师",
        email: "teacher@example.com",
        organizationId: "org-1",
        teacherNo: "T001",
        title: "讲师",
        status: "ACTIVE",
      }).teacherNo,
    ).toBe("T001");
  });

  it("accepts class and enrollment input", () => {
    expect(
      teachingClassSchema.parse({
        name: "程序设计基础 1 班",
        term: "2025-2026-2",
        courseId: "course-1",
        teacherId: "teacher-1",
        organizationId: "",
      }).organizationId,
    ).toBeUndefined();

    expect(
      enrollmentSchema.parse({
        teachingClassId: "class-1",
        studentId: "student-1",
      }),
    ).toEqual({ teachingClassId: "class-1", studentId: "student-1" });
  });

  it("normalizes batch ids and rejects empty batches", () => {
    expect(idsSchema.parse({ ids: [" student-1 ", "student-1", "student-2"] }))
      .toEqual({ ids: ["student-1", "student-2"] });

    expect(() => idsSchema.parse({ ids: [] })).toThrow();
  });
});
