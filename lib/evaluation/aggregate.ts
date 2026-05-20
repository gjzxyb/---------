export type QuestionScoreInput = {
  questionId: string;
  score: number | null;
};

export type QuestionScoreSummary = {
  questionId: string;
  count: number;
  average: number;
};

export type CommentInput = {
  text: string | null;
  createdAt: Date;
  [key: string]: unknown;
};

export type MaskedComment = {
  text: string;
  createdAt: Date;
};

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

export function averageScore(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }

  const total = scores.reduce((sum, score) => sum + score, 0);

  return roundMetric(total / scores.length);
}

export function responseRate(submitted: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return roundMetric((submitted / total) * 100);
}

export function summarizeQuestionScores(
  scores: QuestionScoreInput[],
): QuestionScoreSummary[] {
  const groupedScores = new Map<string, number[]>();

  scores.forEach(({ questionId, score }) => {
    if (!groupedScores.has(questionId)) {
      groupedScores.set(questionId, []);
    }

    if (score !== null) {
      groupedScores.get(questionId)?.push(score);
    }
  });

  return Array.from(groupedScores.entries()).map(([questionId, values]) => ({
    questionId,
    count: values.length,
    average: averageScore(values),
  }));
}

export function maskComments(comments: CommentInput[]): MaskedComment[] {
  return comments.reduce<MaskedComment[]>((maskedComments, comment) => {
    const text = comment.text?.trim();

    if (!text) {
      return maskedComments;
    }

    maskedComments.push({
      text,
      createdAt: comment.createdAt,
    });

    return maskedComments;
  }, []);
}
