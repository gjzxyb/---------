import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  it("accepts graduated student status", () => {
    expect(
      parseStudentImportCsv(
        "姓名,邮箱,学号,年级,专业,组织,状态\n王五,wangwu@example.edu,S003,2022,计算机,高三一班,GRADUATED",
      )[0].status,
    ).toBe("GRADUATED");
  });

  it("accepts Chinese status labels from edited templates", () => {
    const rows = parseStudentImportCsv(
      "姓名,邮箱,学号,年级,专业,组织,状态\n赵六,zhaoliu@example.edu,S004,2026,计算机,高一一班,启用\n钱七,qianqi@example.edu,S005,2026,计算机,高一一班,停用\n孙八,sunba@example.edu,S006,2022,计算机,高三一班,已毕业",
    );

    expect(rows.map((row) => row.status)).toEqual([
      "ACTIVE",
      "INACTIVE",
      "GRADUATED",
    ]);
  });

  it("exports a csv template with the expected headers", () => {
    expect(STUDENT_IMPORT_TEMPLATE_CSV.split("\n")[0]).toBe(
      "姓名,邮箱,学号,年级,专业,组织,状态",
    );
  });
});

describe("student import template route", () => {
  it("accepts POST for import compatibility", () => {
    const routeSource = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/students/import-template/route.ts",
      ),
      "utf8",
    );

    expect(routeSource).toContain("export async function POST");
  });
});

describe("student import action state", () => {
  it("exposes readable import errors without throwing", async () => {
    const source = readFileSync(
      join(process.cwd(), "app/actions/base-data.ts"),
      "utf8",
    );

    expect(source).toContain("export async function importStudentsWithState");
    expect(source).toContain("导入失败");
  });
});

describe("student list batch selection", () => {
  it("uses one visible checkbox per row and provides select helpers", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "app/(admin)/admin/base-data/students/StudentListTable.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("全选");
    expect(source).toContain("反选");
    expect(source).toContain("取消选择");
    expect(source).toContain("selectedIds");
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

  it("parses graduated status filters", () => {
    expect(parseStudentListQuery({ status: "GRADUATED" }).status).toBe(
      "GRADUATED",
    );
  });

  it("caps page size to a controlled set", () => {
    expect(parseStudentListQuery({ pageSize: "200" }).pageSize).toBe(30);
    expect(parseStudentListQuery({ pageSize: "60" }).pageSize).toBe(60);
  });
});
