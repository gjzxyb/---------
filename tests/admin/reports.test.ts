import { describe, expect, it } from "vitest";

import {
  buildCsv,
  buildExcelWorkbook,
  buildReportSearchParams,
  buildScoreTrendCoordinates,
  buildScoreTrendPath,
  maskSensitiveText,
  parseReportQuery,
} from "../../lib/admin/reports";

describe("admin reports helpers", () => {
  it("normalizes report filters", () => {
    expect(
      parseReportQuery({
        term: " 2025-2026-2 ",
        taskId: "",
        teacherId: "teacher-1",
      }),
    ).toEqual({
      courseId: undefined,
      organizationId: undefined,
      taskId: undefined,
      teacherId: "teacher-1",
      term: "2025-2026-2",
    });
  });

  it("builds query strings from active filters", () => {
    expect(
      buildReportSearchParams({ term: "2025-2026-2" }, { courseId: "course-1" }).toString(),
    ).toBe("term=2025-2026-2&courseId=course-1");
  });

  it("masks personal information in comments", () => {
    expect(maskSensitiveText("联系 13812345678 或 a@example.edu，编号 1234567")).toBe(
      "联系 [手机号] 或 [邮箱]，编号 [数字]",
    );
  });

  it("builds csv with escaped cells", () => {
    expect(buildCsv(["名称", "说明"], [["课程,一", '他说"好"']])).toBe(
      '名称,说明\n"课程,一","他说""好"""',
    );
  });

  it("builds an Excel-readable workbook with escaped cells", () => {
    const workbook = buildExcelWorkbook({
      headers: ["教学班", "说明"],
      rows: [["软件工程 1 班", "A&B <优秀>"]],
      sheetName: "教学班报表",
    });

    expect(workbook).toContain("<table");
    expect(workbook).toContain("教学班报表");
    expect(workbook).toContain("软件工程 1 班");
    expect(workbook).toContain("A&amp;B &lt;优秀&gt;");
  });

  it("maps score trends to stable svg coordinates", () => {
    const scores = [5, 2.5, 0];
    const config = { height: 60, maxScore: 5, padding: 10, width: 100 };

    expect(buildScoreTrendCoordinates(scores, config)).toEqual([
      { score: 5, x: 10, y: 10 },
      { score: 2.5, x: 50, y: 30 },
      { score: 0, x: 90, y: 50 },
    ]);
    expect(buildScoreTrendPath(scores, config)).toBe("M 10 10 L 50 30 L 90 50");
  });
});
