import { describe, expect, it } from "vitest";

import {
  parseStudentImportCsv,
  parseStudentListQuery,
  STUDENT_IMPORT_TEMPLATE_CSV,
} from "../../lib/base-data/student-import";

describe("parseStudentImportCsv", () => {
  it("parses the student import template fields", () => {
    const rows = parseStudentImportCsv(
      "姓名,邮箱,学号,年级,专业,组织,状态\n张三,zhangsan@example.edu,S001,2026,计算机,高一一班,ACTIVE",
    );

    expect(rows).toEqual([
      {
        email: "zhangsan@example.edu",
        grade: "2026",
        major: "计算机",
        name: "张三",
        organization: "高一一班",
        status: "ACTIVE",
        studentNo: "S001",
      },
    ]);
  });

  it("defaults blank status to active and rejects missing required fields", () => {
    expect(
      parseStudentImportCsv(
        "姓名,邮箱,学号,年级,专业,组织,状态\n李四,lisi@example.edu,S002,2026,语文,高一一班,",
      )[0].status,
    ).toBe("ACTIVE");

    expect(() =>
      parseStudentImportCsv("姓名,邮箱,学号,年级,专业,组织,状态\n,lisi@example.edu,S002,2026,语文,高一一班,"),
    ).toThrow("第 2 行");
  });

  it("exports a csv template with the expected headers", () => {
    expect(STUDENT_IMPORT_TEMPLATE_CSV.split("\n")[0]).toBe(
      "姓名,邮箱,学号,年级,专业,组织,状态",
    );
  });
});

describe("parseStudentListQuery", () => {
  it("normalizes filters and defaults pagination to thirty rows", () => {
    expect(
      parseStudentListQuery({
        page: "0",
        q: " 张三 ",
        status: "ACTIVE",
      }),
    ).toMatchObject({
      page: 1,
      pageSize: 30,
      q: "张三",
      status: "ACTIVE",
    });
  });

  it("caps page size to a controlled set", () => {
    expect(parseStudentListQuery({ pageSize: "200" }).pageSize).toBe(30);
    expect(parseStudentListQuery({ pageSize: "60" }).pageSize).toBe(60);
  });
});
