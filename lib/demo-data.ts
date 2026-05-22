import type { AssignmentStatus, TaskStatus } from "@/lib/generated/prisma/enums";

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
] as const;

export const ADMIN_REPORT_ROLES = [...ADMIN_ROLES, "ANALYST"] as const;

export const SMALL_SAMPLE_THRESHOLD = 3;

export type MetricTone = "neutral" | "success" | "warning" | "danger" | "info";

export type SubmittedMetricInput = {
  status?: AssignmentStatus | string | null;
  response?: { status?: string | null } | null;
  submittedAt?: Date | null;
};

export type ScoreAnswerInput = {
  score: number | null;
};

export type AggregateBucket = {
  key: string;
  label: string;
  submitted: number;
  scoreTotal: number;
  scoreCount: number;
};

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function emptyWhenDatabaseMissing(entity: string) {
  return `DATABASE_URL 未配置，暂时无法加载${entity}。`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "未设置";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "未设置";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function formatDateWindow(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
) {
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`;
}

export function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

export function percentage(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return roundMetric((numerator / denominator) * 100);
}

export function formatPercent(value: number) {
  return `${roundMetric(value)}%`;
}

export function countSubmitted(assignments: SubmittedMetricInput[]) {
  return assignments.filter(
    (assignment) =>
      assignment.status === "SUBMITTED" ||
      assignment.response?.status === "SUBMITTED" ||
      Boolean(assignment.submittedAt),
  ).length;
}

export function assignmentResponseRate(assignments: SubmittedMetricInput[]) {
  return percentage(countSubmitted(assignments), assignments.length);
}

export function averageScore(answers: ScoreAnswerInput[]) {
  const scores = answers.flatMap((answer) =>
    answer.score === null ? [] : [answer.score],
  );

  if (scores.length === 0) {
    return 0;
  }

  return roundMetric(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function taskStatusLabel(status: TaskStatus | string) {
  const labels: Record<string, string> = {
    DRAFT: "草稿",
    OPEN: "进行中",
    CLOSED: "已关闭",
    ARCHIVED: "已归档",
  };

  return labels[status] ?? status;
}

export function assignmentStatusLabel(status: AssignmentStatus | string) {
  const labels: Record<string, string> = {
    PENDING: "待填写",
    IN_PROGRESS: "填写中",
    SUBMITTED: "已提交",
    EXPIRED: "已过期",
  };

  return labels[status] ?? status;
}

export function taskStatusTone(status: TaskStatus | string): MetricTone {
  if (status === "OPEN") {
    return "success";
  }

  if (status === "DRAFT") {
    return "warning";
  }

  if (status === "CLOSED") {
    return "info";
  }

  return "neutral";
}

export function activeStatusLabel(isActive: boolean) {
  return isActive ? "启用" : "停用";
}

export function activeStatusTone(isActive: boolean): MetricTone {
  return isActive ? "success" : "neutral";
}

export function termTrendSummary(
  terms: { term: string; assignments: SubmittedMetricInput[] }[],
) {
  if (terms.length === 0) {
    return "暂无学期趋势数据";
  }

  const sortedTerms = [...terms].sort((a, b) => b.term.localeCompare(a.term));
  const [currentTerm, previousTerm] = sortedTerms;
  const currentRate = assignmentResponseRate(currentTerm.assignments);

  if (!previousTerm) {
    return `${currentTerm.term} 回收率 ${formatPercent(currentRate)}`;
  }

  const previousRate = assignmentResponseRate(previousTerm.assignments);
  const delta = roundMetric(currentRate - previousRate);
  const direction = delta >= 0 ? "提升" : "下降";

  return `${currentTerm.term} 回收率 ${formatPercent(currentRate)}，较 ${previousTerm.term} ${direction} ${formatPercent(Math.abs(delta))}`;
}

export function addAggregateScore(
  buckets: Map<string, AggregateBucket>,
  key: string,
  label: string,
  answers: ScoreAnswerInput[],
) {
  const bucket =
    buckets.get(key) ??
    ({
      key,
      label,
      submitted: 0,
      scoreTotal: 0,
      scoreCount: 0,
    } satisfies AggregateBucket);

  bucket.submitted += 1;

  answers.forEach((answer) => {
    if (answer.score !== null) {
      bucket.scoreTotal += answer.score;
      bucket.scoreCount += 1;
    }
  });

  buckets.set(key, bucket);
}

export function finalizeAggregates(buckets: Map<string, AggregateBucket>) {
  return Array.from(buckets.values())
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      submitted: bucket.submitted,
      average: bucket.scoreCount === 0 ? 0 : roundMetric(bucket.scoreTotal / bucket.scoreCount),
      scoreCount: bucket.scoreCount,
    }))
    .sort((a, b) => b.submitted - a.submitted || a.label.localeCompare(b.label));
}
