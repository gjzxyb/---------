import { describe, expect, it } from "vitest";

import {
  buildCsv,
  buildReportSearchParams,
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
});
