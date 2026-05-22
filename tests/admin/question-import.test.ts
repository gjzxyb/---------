import { describe, expect, it } from "vitest";

import { parseQuestionCsv } from "../../lib/admin/question-import";

describe("question CSV import", () => {
  it("parses the simplified teacher questionnaire template", () => {
    const rows = parseQuestionCsv(
      [
        "分类,题号,题目,分值,题型,选项串",
        "师德师风,1,不迟到不早退，不随意调课,5,单选,A.非常满意|B.满意|C.一般|D.不太满意|E.不满意",
        "开放建议,20,你对本课程还有哪些建议,,文本,",
      ].join("\n"),
    );

    expect(rows).toEqual([
      {
        category: "师德师风",
        sortOrder: 1,
        title: "不迟到不早退，不随意调课",
        maxScore: 5,
        type: "SCALE",
        optionsText: "A.非常满意|B.满意|C.一般|D.不太满意|E.不满意",
        required: true,
      },
      {
        category: "开放建议",
        sortOrder: 20,
        title: "你对本课程还有哪些建议",
        maxScore: null,
        type: "TEXT",
        optionsText: "",
        required: true,
      },
    ]);
  });
});
