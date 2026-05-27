import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ENROLLMENT_IMPORT_TEMPLATE_CSV,
  TEACHING_CLASS_IMPORT_TEMPLATE_CSV,
  parseClassListQuery,
  parseEnrollmentImportCsv,
  parseEnrollmentListQuery,
  planGradePrefixEnrollments,
  parseTeachingClassImportCsv,
  summarizeGradePrefixEnrollmentPlan,
} from "../../lib/base-data/class-enrollment";

describe("parseTeachingClassImportCsv", () => {
  it("parses teaching class import rows", () => {
    expect(
      parseTeachingClassImportCsv(
        "教学班,学期,课程代码,教师工号,组织\n程序设计基础 1 班,2025-2026-2,CS101,T001,信息工程学院",
      ),
    ).toEqual([
      {
        courseCode: "CS101",
        name: "程序设计基础 1 班",
        organization: "信息工程学院",
        teacherNo: "T001",
        term: "2025-2026-2",
      },
    ]);
  });

  it("rejects missing required teaching class fields", () => {
    expect(() =>
      parseTeachingClassImportCsv(
        "教学班,学期,课程代码,教师工号,组织\n程序设计基础 1 班,2025-2026-2,,T001,信息工程学院",
      ),
    ).toThrow("第 2 行");
  });

  it("exports the expected teaching class import headers", () => {
    expect(TEACHING_CLASS_IMPORT_TEMPLATE_CSV.split("\n")[0]).toBe(
      "教学班,学期,课程代码,教师工号,组织",
    );
  });
});

describe("parseEnrollmentImportCsv", () => {
  it("parses enrollment import rows", () => {
    expect(
      parseEnrollmentImportCsv(
        "学期,教学班,学号\n2025-2026-2,程序设计基础 1 班,S001",
      ),
    ).toEqual([
      {
        studentNo: "S001",
        teachingClassName: "程序设计基础 1 班",
        term: "2025-2026-2",
      },
    ]);
  });

  it("rejects missing required enrollment fields", () => {
    expect(() =>
      parseEnrollmentImportCsv("学期,教学班,学号\n2025-2026-2,,S001"),
    ).toThrow("第 2 行");
  });

  it("exports the expected enrollment import headers", () => {
    expect(ENROLLMENT_IMPORT_TEMPLATE_CSV.split("\n")[0]).toBe(
      "学期,教学班,学号",
    );
  });
});

describe("class and enrollment list queries", () => {
  it("normalizes class filters and pagination", () => {
    expect(
      parseClassListQuery({
        classPage: "0",
        classPageSize: "60",
        q: " 程序设计 ",
        term: " 2025-2026-2 ",
      }),
    ).toMatchObject({
      classPage: 1,
      classPageSize: 60,
      q: "程序设计",
      term: "2025-2026-2",
    });
  });

  it("normalizes enrollment filters and pagination", () => {
    expect(
      parseEnrollmentListQuery({
        enrollmentPage: "2",
        enrollmentPageSize: "200",
        enrollmentQ: " 张三 ",
      }),
    ).toMatchObject({
      enrollmentPage: 2,
      enrollmentPageSize: 30,
      enrollmentQ: "张三",
    });
  });
});

describe("planGradePrefixEnrollments", () => {
  it("matches student grade with the first seven characters of teaching class names", () => {
    expect(
      planGradePrefixEnrollments({
        existingEnrollments: [{ studentId: "student-1", teachingClassId: "class-1" }],
        students: [
          { id: "student-1", grade: "G202801" },
          { id: "student-2", grade: "G202801" },
          { id: "student-3", grade: "G202901" },
        ],
        teachingClasses: [
          { id: "class-1", name: "G202801语文教学班" },
          { id: "class-2", name: "G202801数学教学班" },
          { id: "class-3", name: "G202901英语教学班" },
        ],
      }),
    ).toEqual([
      { studentId: "student-1", teachingClassId: "class-2" },
      { studentId: "student-2", teachingClassId: "class-1" },
      { studentId: "student-2", teachingClassId: "class-2" },
      { studentId: "student-3", teachingClassId: "class-3" },
    ]);
  });

  it("reports class prefixes that do not have matching student grades", () => {
    expect(
      summarizeGradePrefixEnrollmentPlan({
        existingEnrollments: [],
        students: [{ id: "student-1", grade: "G202801" }],
        teachingClasses: [
          { id: "class-1", name: "G202801语文教学班" },
          { id: "class-2", name: "G202619_LZ101" },
        ],
      }),
    ).toMatchObject({
      matchedClassCount: 1,
      matchedStudentCount: 1,
      unmatchedClassPrefixes: ["G202619"],
    });
  });
});

describe("class import template routes", () => {
  it("accepts POST for teaching class and enrollment import compatibility", () => {
    const teachingClassRoute = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/classes/class-import-template/route.ts",
      ),
      "utf8",
    );
    const enrollmentRoute = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/classes/import-template/route.ts",
      ),
      "utf8",
    );

    expect(teachingClassRoute).toContain("export async function POST");
    expect(enrollmentRoute).toContain("export async function POST");
  });
});

describe("class and enrollment import and selection UI", () => {
  it("exposes readable import errors and batch selection helpers", () => {
    const actionSource = readFileSync(
      join(process.cwd(), "app/actions/base-data.ts"),
      "utf8",
    );
    const classTableSource = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/classes/TeachingClassListTable.tsx",
      ),
      "utf8",
    );
    const enrollmentTableSource = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/classes/EnrollmentListTable.tsx",
      ),
      "utf8",
    );

    expect(actionSource).toContain(
      "export async function importTeachingClassesWithState",
    );
    expect(actionSource).toContain("export async function importEnrollmentsWithState");
    for (const source of [classTableSource, enrollmentTableSource]) {
      expect(source).toContain("全选");
      expect(source).toContain("反选");
      expect(source).toContain("取消选择");
    }
  });
});
