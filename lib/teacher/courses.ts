export type TeacherCourseQuery = {
  q: string;
  status: "ALL" | "OPEN_TASK" | "NO_TASK" | "COMPLETED";
  term: string;
};

export type CourseAssignmentInput = {
  status: string;
  submittedAt: Date | null;
  task: {
    status: string;
    endsAt: Date | null;
  };
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTeacherCourseQuery(
  searchParams: Record<string, string | string[] | undefined>,
): TeacherCourseQuery {
  const rawStatus = firstValue(searchParams.status);
  const status =
    rawStatus === "OPEN_TASK" || rawStatus === "NO_TASK" || rawStatus === "COMPLETED"
      ? rawStatus
      : "ALL";

  return {
    q: firstValue(searchParams.q)?.trim() ?? "",
    status,
    term: firstValue(searchParams.term)?.trim() ?? "",
  };
}

export function summarizeCourseAssignments(assignments: CourseAssignmentInput[]) {
  const total = assignments.length;
  const submitted = assignments.filter(
    (assignment) => assignment.status === "SUBMITTED",
  ).length;
  const openTasks = assignments.filter(
    (assignment) => assignment.task.status === "OPEN",
  ).length;
  const expired = assignments.filter(
    (assignment) => assignment.status === "EXPIRED",
  ).length;
  const pending = Math.max(0, total - submitted - expired);
  const responseRate = total === 0 ? 0 : Math.round((submitted / total) * 100);
  const nextDeadline = assignments
    .map((assignment) => assignment.task.endsAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return {
    expired,
    nextDeadline: nextDeadline ?? null,
    openTasks,
    pending,
    responseRate,
    submitted,
    total,
  };
}

export function getCourseStatusLabel(assignments: CourseAssignmentInput[]) {
  const summary = summarizeCourseAssignments(assignments);

  if (summary.total === 0) {
    return "暂无任务";
  }

  if (summary.openTasks > 0) {
    return "收集中";
  }

  if (summary.submitted === summary.total) {
    return "已完成";
  }

  return "已结束";
}

export function courseMatchesStatus(
  assignments: CourseAssignmentInput[],
  status: TeacherCourseQuery["status"],
) {
  const summary = summarizeCourseAssignments(assignments);

  if (status === "ALL") {
    return true;
  }

  if (status === "OPEN_TASK") {
    return summary.openTasks > 0;
  }

  if (status === "NO_TASK") {
    return summary.total === 0;
  }

  return summary.total > 0 && summary.submitted === summary.total;
}
