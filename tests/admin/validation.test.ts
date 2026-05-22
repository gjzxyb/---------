import { describe, expect, it } from "vitest";

import {
  adminSettingsSchema,
  evaluationTaskSchema,
  questionBankDeleteSchema,
  questionBankItemSchema,
  templateDeleteSchema,
  templateQuestionUpdateSchema,
  templateSchema,
  templateQuestionDraftSchema,
  taskStatusUpdateSchema,
  userRoleUpdateSchema,
} from "../../lib/evaluation/validation";

describe("admin validation schemas", () => {
  it("accepts a scale question bank item", () => {
    const parsed = questionBankItemSchema.parse({
      type: "SCALE",
      title: "教学内容重点突出",
      description: "关注课堂目标和内容组织",
      maxScore: "5",
      isActive: "on",
    });

    expect(parsed).toEqual({
      type: "SCALE",
      title: "教学内容重点突出",
      description: "关注课堂目标和内容组织",
      maxScore: 5,
      isActive: true,
    });
  });

  it("accepts question bank delete requests", () => {
    expect(questionBankDeleteSchema.parse({ questionId: "question-1" })).toEqual({
      questionId: "question-1",
    });
  });

  it("accepts a template with selected question ids", () => {
    const parsed = templateSchema.parse({
      name: "课堂教学质量评价",
      version: "2",
      isActive: "on",
      questionsJson: JSON.stringify([
        {
          questionItemId: "q-1",
          title: "课堂重点突出",
          type: "SCALE",
          maxScore: 5,
          sortOrder: 1,
          required: true,
        },
      ]),
    });

    expect(parsed.questions).toHaveLength(1);
    expect(parsed.version).toBe(2);
  });

  it("accepts editable template question drafts", () => {
    const parsed = templateQuestionDraftSchema.parse({
      category: "师德师风",
      sortOrder: "1",
      title: "不迟到不早退",
      type: "SCALE",
      maxScore: "5",
      optionsText: "A.满意|B.一般",
      required: "on",
    });

    expect(parsed).toMatchObject({
      category: "师德师风",
      sortOrder: 1,
      title: "不迟到不早退",
      type: "SCALE",
      maxScore: 5,
      optionsText: "A.满意|B.一般",
      required: true,
    });
  });

  it("accepts template question updates", () => {
    const parsed = templateQuestionUpdateSchema.parse({
      templateId: "template-1",
      isActive: "on",
      questionsJson: JSON.stringify([
        {
          title: "课堂重点突出",
          type: "SCALE",
          sortOrder: 1,
          maxScore: 5,
          required: true,
          category: "教学质量",
          optionsText: "A.满意|B.一般",
        },
      ]),
    });

    expect(parsed.templateId).toBe("template-1");
    expect(parsed.questions).toHaveLength(1);
  });

  it("accepts template delete requests", () => {
    expect(templateDeleteSchema.parse({ templateId: "template-1" })).toEqual({
      templateId: "template-1",
    });
  });

  it("accepts an evaluation task with optional dates", () => {
    const parsed = evaluationTaskSchema.parse({
      templateId: "template-1",
      name: "2026 春季学期评教",
      term: "2025-2026-2",
      status: "DRAFT",
      startsAt: "2026-05-01T08:00",
      endsAt: "",
    });

    expect(parsed.endsAt).toBeUndefined();
    expect(parsed.startsAt).toBeInstanceOf(Date);
  });

  it("accepts task status transitions", () => {
    expect(
      taskStatusUpdateSchema.parse({ taskId: "task-1", status: "OPEN" }),
    ).toEqual({ taskId: "task-1", status: "OPEN" });
  });

  it("normalizes admin settings", () => {
    const parsed = adminSettingsSchema.parse({
      academicYear: "2025-2026",
      anonymousSubmission: "on",
      currentTerm: "2025-2026-2",
      dataIsolation: "on",
      dictionaryParametersText: "题型=SCALE / TEXT",
      exportWatermark: "on",
      academicSystemEndpoint: "https://jw.example.edu",
      textDesensitization: "on",
      lmsEndpoint: "",
      messageWebhook: "",
      smallSampleThreshold: "4",
      reminderChannels: ["站内信", "邮件"],
      resultReleaseMode: "MANUAL",
      ssoProvider: "CAS",
      termEndDate: "",
      termStartDate: "2026-03-01",
      interfaceNote: "对接统一门户",
    });

    expect(parsed).toMatchObject({
      academicYear: "2025-2026",
      anonymousSubmission: true,
      currentTerm: "2025-2026-2",
      dataIsolation: true,
      dictionaryParametersText: "题型=SCALE / TEXT",
      exportWatermark: true,
      academicSystemEndpoint: "https://jw.example.edu",
      textDesensitization: true,
      lmsEndpoint: undefined,
      messageWebhook: undefined,
      smallSampleThreshold: 4,
      reminderChannels: ["站内信", "邮件"],
      resultReleaseMode: "MANUAL",
      ssoProvider: "CAS",
      termEndDate: undefined,
      termStartDate: "2026-03-01",
      interfaceNote: "对接统一门户",
    });
  });

  it("accepts user role updates", () => {
    expect(
      userRoleUpdateSchema.parse({
        userId: "user-1",
        role: "SCHOOL_ADMIN",
      }),
    ).toEqual({
      userId: "user-1",
      role: "SCHOOL_ADMIN",
    });

    expect(() =>
      userRoleUpdateSchema.parse({
        userId: "user-1",
        role: "UNKNOWN",
      }),
    ).toThrow();
  });
});
