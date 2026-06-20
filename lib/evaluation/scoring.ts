export type ScoredAnswerInput = {
  question?: { maxScore: number | null } | null;
  score: number | null;
};

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

export function scoreAnswerValue(
  score: number,
  maxScore: number | null | undefined,
) {
  if (!(typeof maxScore === "number" && Number.isFinite(maxScore) && maxScore > 0)) {
    return null;
  }

  return Math.min(score, maxScore);
}

export function responseScoreTotal(answers: ScoredAnswerInput[]) {
  let scoreCount = 0;
  let total = 0;

  answers.forEach((answer) => {
    if (answer.score === null) {
      return;
    }

    const score = scoreAnswerValue(answer.score, answer.question?.maxScore);

    if (score === null) {
      return;
    }

    scoreCount += 1;
    total += score;
  });

  return scoreCount === 0 ? null : { scoreCount, total };
}

export function averageResponseScore(totals: number[]) {
  if (totals.length === 0) {
    return 0;
  }

  return roundMetric(totals.reduce((sum, score) => sum + score, 0) / totals.length);
}
