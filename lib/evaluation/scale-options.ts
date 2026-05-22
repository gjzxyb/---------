const SATISFACTION_LABELS = [
  "A.非常满意",
  "B.满意",
  "C.一般",
  "D.不太满意",
  "E.不满意",
] as const;

export type ScaleOption = {
  label: string;
  value: number;
};

export function getScaleOptions(maxScore: number | null | undefined) {
  const optionCount =
    typeof maxScore === "number" && Number.isFinite(maxScore)
      ? Math.min(Math.max(Math.trunc(maxScore), 1), SATISFACTION_LABELS.length)
      : SATISFACTION_LABELS.length;

  return SATISFACTION_LABELS.slice(0, optionCount).map((label, index) => ({
    label,
    value: optionCount - index,
  }));
}
