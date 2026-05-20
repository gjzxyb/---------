import { describe, expect, it } from "vitest";

import {
  averageScore,
  maskComments,
  responseRate,
  summarizeQuestionScores,
} from "../../lib/evaluation/aggregate";

describe("evaluation aggregation", () => {
  it("averages scores", () => {
    expect(averageScore([5, 4, 3])).toBe(4);
  });

  it("returns response rate as a percentage", () => {
    expect(responseRate(8, 10)).toBe(80);
  });

  it("groups scores per question and returns averages", () => {
    expect(
      summarizeQuestionScores([
        { questionId: "question-1", score: 5 },
        { questionId: "question-1", score: 3 },
        { questionId: "question-2", score: 4 },
        { questionId: "question-2", score: null },
      ]),
    ).toEqual([
      { questionId: "question-1", count: 2, average: 4 },
      { questionId: "question-2", count: 1, average: 4 },
    ]);
  });

  it("removes empty comments and only returns text plus created date", () => {
    const createdAt = new Date("2026-05-20T08:00:00.000Z");

    expect(
      maskComments([
        {
          text: " Useful feedback ",
          createdAt,
          studentId: "student-1",
          userId: "user-1",
        },
        { text: "   ", createdAt: new Date("2026-05-21T08:00:00.000Z") },
      ]),
    ).toEqual([{ text: "Useful feedback", createdAt }]);
  });
});
