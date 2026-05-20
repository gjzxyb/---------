import { describe, expect, it } from "vitest";

import {
  evaluationSubmissionSchema,
  scaleAnswerSchema,
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
});
