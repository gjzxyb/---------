import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  COURSE_IMPORT_TEMPLATE_CSV,
  parseCourseImportCsv,
} from "../../lib/base-data/course-import";

describe("parseCourseImportCsv", () => {
  it("parses course import rows", () => {
    expect(
      parseCourseImportCsv(
        "课程代码,课程名称,组织\nCS101,程序设计基础,信息工程学院",
      ),
    ).toEqual([
      {
        code: "CS101",
        name: "程序设计基础",
        organization: "信息工程学院",
      },
    ]);
  });

  it("allows empty organization cells", () => {
    expect(parseCourseImportCsv("课程代码,课程名称,组织\nCS102,数据结构,")).toEqual([
      {
        code: "CS102",
        name: "数据结构",
        organization: undefined,
      },
    ]);
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseCourseImportCsv("课程代码,课程名称,组织\n,程序设计基础,信息工程学院"),
    ).toThrow("第 2 行");
  });

  it("exports the expected import headers", () => {
    expect(COURSE_IMPORT_TEMPLATE_CSV.split("\n")[0]).toBe(
      "课程代码,课程名称,组织",
    );
  });
});

describe("course import action state", () => {
  it("exposes readable import errors and batch selection helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/actions/base-data.ts"),
      "utf8",
    );
    const tableSource = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/courses/CourseListTable.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("export async function importCoursesWithState");
    expect(source).toContain("export async function deleteCourses");
    expect(tableSource).toContain("全选");
    expect(tableSource).toContain("反选");
    expect(tableSource).toContain("取消选择");
  });
});
