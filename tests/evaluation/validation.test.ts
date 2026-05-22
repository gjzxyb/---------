import { describe, expect, it } from "vitest";

import {
  evaluationSubmissionSchema,
  improvementPlanSchema,
  scaleAnswerSchema,
  taskAssignmentGenerationSchema,
  taskDeleteSchema,
  textAnswerSchema,
} from "../../lib/evaluation/validation";

describe("evaluation validation", () => {
  it("accepts scale answers with a question id and numeric score from 1 to 5", () => {
    const result = scaleAnswerSchema.safeParse({
      questionId: "question-1",
      score: 5,
    });

    expect(result.success).toBe(true);
  });

  it("accepts open text answers with a question id and non-empty text", () => {
    const result = textAnswerSchema.safeParse({
      questionId: "question-2",
      text: "The pacing was clear.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mixed answers with both score and text", () => {
    const result = evaluationSubmissionSchema.safeParse({
      assignmentId: "assignment-1",
      answers: [{ questionId: "question-1", score: 5, text: "mixed" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects scale answers outside the 1 to 5 bounds", () => {
    expect(
      scaleAnswerSchema.safeParse({ questionId: "question-1", score: 0 })
        .success,
    ).toBe(false);
    expect(
      scaleAnswerSchema.safeParse({ questionId: "question-1", score: 6 })
        .success,
    ).toBe(false);
  });

  it("rejects blank question ids and blank open text", () => {
    expect(
      scaleAnswerSchema.safeParse({ questionId: "   ", score: 4 }).success,
    ).toBe(false);
    expect(
      textAnswerSchema.safeParse({ questionId: "question-1", text: "   " })
        .success,
    ).toBe(false);
  });

  it("rejects submissions with an empty answers array", () => {
    const result = evaluationSubmissionSchema.safeParse({
      assignmentId: "assignment-1",
      answers: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects submissions with duplicate question ids", () => {
    const result = evaluationSubmissionSchema.safeParse({
      assignmentId: "assignment-1",
      answers: [
        { questionId: "question-1", score: 4 },
        { questionId: "question-1", text: "Already answered." },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts improvement plan deadline strings and converts them to dates", () => {
    const result = improvementPlanSchema.safeParse({
      teacherId: "teacher-1",
      teachingClassId: "class-1",
      title: "Improve feedback timing",
      action: "Return rubric notes within one week.",
      deadline: "2026-06-01",
      evidence: "",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.deadline).toBeInstanceOf(Date);
    expect(result.data.deadline?.toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.data.evidence).toBeUndefined();
  });

  it("parses task assignment generation with repeated class ids", () => {
    const result = taskAssignmentGenerationSchema.safeParse({
      organizationIds: ["org-1"],
      taskId: "task-1",
      teachingClassIds: ["class-1", "class-2"],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toEqual({
      organizationIds: ["org-1"],
      taskId: "task-1",
      teachingClassIds: ["class-1", "class-2"],
    });
  });

  it("normalizes empty task assignment class selection to all classes", () => {
    const result = taskAssignmentGenerationSchema.safeParse({
      taskId: "task-1",
      teachingClassIds: [],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.teachingClassIds).toEqual([]);
  });

  it("requires a task id before deleting a task", () => {
    expect(taskDeleteSchema.safeParse({ taskId: "" }).success).toBe(false);
  });
});
