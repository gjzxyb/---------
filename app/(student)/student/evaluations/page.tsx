import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  appCachePrefixes,
  cachedJson,
  stableCachePart,
} from "@/lib/cache/app-cache";

type AssignmentRow = {
  id: string;
  status: string;
  assignedAt: Date;
  submittedAt: Date | null;
  response: {
    status: string;
    updatedAt: Date;
    submittedAt: Date | null;
  } | null;
  task: {
    name: string;
    term: string;
    status: string;
    startsAt: Date | null;
    endsAt: Date | null;
  };
  teachingClass: {
    name: string;
    course: { name: string; code: string };
    teacher: { name: string };
  };
};

type AssignmentListState = {
  actionLabel: string;
  dateLabel: string;
  statusLabel: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
};

type EvaluationListData = {
  pending: AssignmentRow[];
  completed: AssignmentRow[];
  isDatabaseConfigured: boolean;
};

async function loadEvaluations(userId: string): Promise<EvaluationListData> {
  return cachedJson({
    key: `${appCachePrefixes.studentEvaluations}${stableCachePart(userId)}:list`,
    loader: () => loadFreshEvaluations(userId),
    ttlSeconds: 20,
  });
}

async function loadFreshEvaluations(userId: string): Promise<EvaluationListData> {
  if (!process.env.DATABASE_URL) {
    return { pending: [], completed: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const assignments = await prisma.evaluationAssignment.findMany({
    where: { evaluatorId: userId },
    select: {
      assignedAt: true,
      id: true,
      status: true,
      submittedAt: true,
      response: {
        select: {
          status: true,
          submittedAt: true,
          updatedAt: true,
        },
      },
      task: {
        select: {
          endsAt: true,
          name: true,
          startsAt: true,
          status: true,
          term: true,
        },
      },
      teachingClass: {
        select: {
          name: true,
          course: { select: { code: true, name: true } },
          teacher: { select: { name: true } },
        },
      },
    },
    orderBy: [{ assignedAt: "desc" }],
  });

  return {
    pending: assignments.filter(
      (assignment) =>
        assignment.status !== "SUBMITTED" &&
        assignment.response?.status !== "SUBMITTED",
    ),
    completed: assignments.filter(
      (assignment) =>
        assignment.status === "SUBMITTED" ||
        assignment.response?.status === "SUBMITTED",
    ),
    isDatabaseConfigured: true,
  };
}

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getAssignmentListState(
  assignment: AssignmentRow,
  mode: "pending" | "completed",
  now = new Date(),
): AssignmentListState {
  if (
    mode === "completed" ||
    assignment.status === "SUBMITTED" ||
    assignment.response?.status === "SUBMITTED"
  ) {
    return {
      actionLabel: "查看",
      dateLabel: formatDate(assignment.response?.submittedAt ?? assignment.submittedAt),
      statusLabel: "已提交",
      tone: "success",
    };
  }

  if (assignment.response?.status === "DRAFT") {
    return {
      actionLabel: "继续填写",
      dateLabel: formatDate(assignment.task.endsAt),
      statusLabel: "草稿",
      tone: "warning",
    };
  }

  if (assignment.status === "EXPIRED") {
    return {
      actionLabel: "查看",
      dateLabel: formatDate(assignment.task.endsAt),
      statusLabel: "已过期",
      tone: "danger",
    };
  }

  if (assignment.task.status !== "OPEN") {
    return {
      actionLabel: "查看",
      dateLabel: formatDate(assignment.task.startsAt),
      statusLabel: "任务未开放",
      tone: "neutral",
    };
  }

  if (assignment.task.startsAt && assignment.task.startsAt > now) {
    return {
      actionLabel: "查看",
      dateLabel: formatDate(assignment.task.startsAt),
      statusLabel: "未开始",
      tone: "info",
    };
  }

  if (assignment.task.endsAt && assignment.task.endsAt < now) {
    return {
      actionLabel: "查看",
      dateLabel: formatDate(assignment.task.endsAt),
      statusLabel: "已截止",
      tone: "danger",
    };
  }

  return {
    actionLabel: assignment.status === "IN_PROGRESS" ? "继续填写" : "填写",
    dateLabel: formatDate(assignment.task.endsAt),
    statusLabel: assignment.status === "IN_PROGRESS" ? "填写中" : "待填写",
    tone: "warning",
  };
}

function EvaluationTable({
  assignments,
  emptyText,
  mode,
}: {
  assignments: AssignmentRow[];
  emptyText: string;
  mode: "pending" | "completed";
}) {
  const rows = assignments.map((assignment) => {
    const listState = getAssignmentListState(assignment, mode);

    return { assignment, listState };
  });

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.length ? (
          rows.map(({ assignment, listState }) => (
            <article
              key={assignment.id}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-950">
                    {assignment.teachingClass.course.name}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {assignment.teachingClass.course.code} ·{" "}
                    {assignment.teachingClass.name}
                  </p>
                </div>
                <StatusBadge tone={listState.tone}>
                  {listState.statusLabel}
                </StatusBadge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">教师</dt>
                  <dd className="mt-1 text-slate-900">
                    {assignment.teachingClass.teacher.name}
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">
                    {mode === "completed" ? "提交日期" : "关键日期"}
                  </dt>
                  <dd className="mt-1 text-slate-900">{listState.dateLabel}</dd>
                </div>
              </dl>
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                <div className="font-medium text-slate-900">
                  {assignment.task.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {assignment.task.term}
                </div>
              </div>
              <Link
                href={`/student/evaluations/${assignment.id}`}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white"
              >
                {listState.actionLabel}
              </Link>
            </article>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {emptyText}
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              课程
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              教师
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              任务
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              状态
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              日期
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length ? (
            rows.map(({ assignment, listState }) => (
              <tr key={assignment.id}>
                <td className="px-4 py-4 text-sm text-slate-900">
                  <div className="font-medium">
                    {assignment.teachingClass.course.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {assignment.teachingClass.course.code} ·{" "}
                    {assignment.teachingClass.name}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">
                  {assignment.teachingClass.teacher.name}
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">
                  <div>{assignment.task.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {assignment.task.term}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm">
                  <StatusBadge tone={listState.tone}>
                    {listState.statusLabel}
                  </StatusBadge>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">
                  {listState.dateLabel}
                </td>
                <td className="px-4 py-4 text-right text-sm">
                  <Link
                    href={`/student/evaluations/${assignment.id}`}
                    className="font-medium text-sky-700 transition hover:text-sky-900"
                  >
                    {listState.actionLabel}
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-sm text-slate-500"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </>
  );
}

export default async function StudentEvaluationsPage() {
  const session = await requireRole(["STUDENT"]);
  const { pending, completed, isDatabaseConfigured } = await loadEvaluations(
    session.user.id,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div>
        <StatusBadge tone="info">学生评教</StatusBadge>
        <h1 className="mt-3 text-xl font-semibold tracking-normal text-slate-950 sm:text-2xl">
          我的评教任务
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          查看待填写、草稿和已提交的课程评价。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载真实评教任务。
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">待评价</h2>
          <StatusBadge tone="warning">{pending.length} 项</StatusBadge>
        </div>
        <EvaluationTable
          assignments={pending}
          emptyText="暂无待完成评教。"
          mode="pending"
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">已评价</h2>
          <StatusBadge tone="success">{completed.length} 项</StatusBadge>
        </div>
        <EvaluationTable
          assignments={completed}
          emptyText="暂无已提交评教。"
          mode="completed"
        />
      </section>
    </div>
  );
}
