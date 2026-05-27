import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseTeacherImportCsv,
  parseTeacherListQuery,
  TEACHER_IMPORT_TEMPLATE_CSV,
} from "../../lib/base-data/teacher-import";

describe("parseTeacherImportCsv", () => {
  it("parses the teacher import template fields", () => {
    const rows = parseTeacherImportCsv(
      "姓名,邮箱,工号,职称,组织,状态\n李老师,li@example.edu,T001,教授,信息工程学院,ACTIVE",
    );

    expect(rows).toEqual([
      {
        email: "li@example.edu",
        name: "李老师",
        organization: "信息工程学院",
        status: "ACTIVE",
        teacherNo: "T001",
        title: "教授",
      },
    ]);
  });

  it("defaults blank status to active and rejects missing required fields", () => {
    expect(
      parseTeacherImportCsv(
        "姓名,邮箱,工号,职称,组织,状态\n王老师,wang@example.edu,T002,讲师,信息工程学院,",
      )[0].status,
    ).toBe("ACTIVE");

    expect(() =>
      parseTeacherImportCsv(
        "姓名,邮箱,工号,职称,组织,状态\n,wang@example.edu,T002,讲师,信息工程学院,",
      ),
    ).toThrow("第 2 行");
  });

  it("exports a csv template with the expected headers", () => {
    expect(TEACHER_IMPORT_TEMPLATE_CSV.split("\n")[0]).toBe(
      "姓名,邮箱,工号,职称,组织,状态",
    );
  });
});

describe("parseTeacherListQuery", () => {
  it("normalizes filters and defaults pagination to thirty rows", () => {
    expect(
      parseTeacherListQuery({
        page: "0",
        q: " 李老师 ",
        status: "ACTIVE",
        title: " 教授 ",
      }),
    ).toMatchObject({
      page: 1,
      pageSize: 30,
      q: "李老师",
      status: "ACTIVE",
      title: "教授",
    });
  });

  it("caps page size to a controlled set", () => {
    expect(parseTeacherListQuery({ pageSize: "200" }).pageSize).toBe(30);
    expect(parseTeacherListQuery({ pageSize: "60" }).pageSize).toBe(60);
  });
});

describe("teacher import template route", () => {
  it("accepts POST for import compatibility", () => {
    const routeSource = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/teachers/import-template/route.ts",
      ),
      "utf8",
    );

    expect(routeSource).toContain("export async function POST");
  });
});
