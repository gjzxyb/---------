import { describe, expect, it } from "vitest";

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
