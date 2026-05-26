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

export type TeacherTeachingClassInput = {
  courseId: string;
  name: string;
  organizationId?: string;
  term: string;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function requiredText(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const trimmedValue = requiredText(value);

  return trimmedValue || undefined;
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

export function parseTeacherTeachingClassInput(
  values: Record<string, unknown>,
): TeacherTeachingClassInput {
  const parsed = {
    courseId: requiredText(values.courseId),
    name: requiredText(values.name),
    organizationId: optionalText(values.organizationId),
    term: requiredText(values.term),
  };

  if (!parsed.courseId || !parsed.name || !parsed.term) {
    throw new Error("Teaching class requires course, name and term.");
  }

  return parsed;
}

export function canMaintainTeachingClass({
  assignmentCount,
  currentTerm,
  term,
}: {
  assignmentCount: number;
  currentTerm: string;
  term: string;
}) {
  const canEdit = Boolean(currentTerm) && term === currentTerm;

  return {
    canChangeCourse: canEdit && assignmentCount === 0,
    canEdit,
  };
}
