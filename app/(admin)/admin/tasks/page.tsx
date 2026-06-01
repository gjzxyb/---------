import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  closeEvaluationTaskAndExpirePending,
  createEvaluationTask,
  deleteEvaluationAssignment,
  deleteEvaluationTask,
  generateEvaluationAssignments,
  remindPendingEvaluationAssignments,
  updateEvaluationTaskStatus,
} from "@/app/actions/admin";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  assignmentStatusLabel,
  emptyWhenDatabaseMissing,
  formatDateTime,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
  roundMetric,
  taskStatusLabel,
  taskStatusTone,
} from "@/lib/demo-data";
import type { $Enums, Prisma } from "@/lib/generated/prisma/client";
import {
  formatSubmissionStatusText,
  isTaskVisibleInRecoveryDetail,
  nextRestoredTaskStatus,
} from "@/lib/evaluation/task-publishing";

const TASK_PAGE_SIZE = 20;
const ASSIGNMENT_PAGE_SIZE = 30;
const CLASS_PAGE_SIZE = 60;

type TaskPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type PageWindow = {
  currentPage: number;
  totalItems: number;
  totalPages: number;
  pageSize: number;
  offset: number;
};

type TaskAssignmentRow = {
  id: string;
  status: string;
  assignedAt: Date;
  submittedAt: Date | null;
  evaluator: {
    name: string;
    email: string;
    studentProfile: { studentNo: string } | null;
  };
  teachingClass: {
    name: string;
    term: string;
    course: { code: string; name: string };
    teacher: { name: string };
  };
  response: { status: string; submittedAt: Date | null } | null;
};

type TaskSummary = {
  expired: number;
  inProgress: number;
  pending: number;
  responseCount: number;
  responseRate: number;
  submitted: number;
  total: number;
};

type TaskRow = {
  endsAt: Date | null;
  id: string;
  name: string;
  startsAt: Date | null;
  status: string;
  summary: TaskSummary;
  term: string;
  template: { name: string; version: number };
};

type TeachingClassOption = {
  id: string;
  name: string;
  term: string;
  organizationId: string | null;
  course: { code: string; name: string };
  teacher: { name: string };
  _count: { enrollments: number };
};

type OrganizationOption = {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
};

type OrganizationOptionView = OrganizationOption & {
  classCount: number;
};

type TaskOverviewData = {
  assignmentCount: number;
  expiredCount: number;
  isDatabaseConfigured: boolean;
  openTaskCount: number;
  submittedCount: number;
  taskCount: number;
  taskPage: PageWindow;
  tasks: TaskRow[];
  templates: { id: string; name: string; version: number; isActive: boolean }[];
};

type TaskDetailData = {
  assignmentPage: PageWindow;
  assignments: TaskAssignmentRow[];
  classPage: PageWindow;
  classSearch: string;
  classes: TeachingClassOption[];
  detailMessage: string | null;
  organizations: OrganizationOptionView[];
  task: {
    endsAt: Date | null;
    id: string;
    name: string;
    startsAt: Date | null;
    status: string;
    term: string;
    template: { name: string; version: number };
  } | null;
  summary: TaskSummary | null;
  totalAssignments: number;
};

const assignmentStatuses = new Set(["PENDING", "IN_PROGRESS", "SUBMITTED", "EXPIRED"]);

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageNumber(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const page = Number(firstSearchValue(searchParams[key]));

  return Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
}

function parseSearchText(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  return firstSearchValue(searchParams[key])?.trim() ?? "";
}

function paginate(totalItems: number, requestedPage: number, pageSize: number): PageWindow {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const currentPage = Math.min(Math.max(Math.trunc(requestedPage), 1), totalPages);

  return {
    currentPage,
    offset: (currentPage - 1) * pageSize,
    pageSize,
    totalItems,
    totalPages,
  };
}

function buildHref(
  searchParams: Record<string, string | string[] | undefined>,
  updates: Record<string, string | number | null | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) {
          params.append(key, item);
        }
      });
      return;
    }

    if (value) {
      params.set(key, value);
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      params.delete(key);
      return;
    }

    params.set(key, String(value));
  });

  const queryString = params.toString();

  return queryString ? `/admin/tasks?${queryString}` : "/admin/tasks";
}

function preserveSearchInputs({
  exclude = [],
  searchParams,
}: {
  exclude?: string[];
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return Object.entries(searchParams).flatMap(([key, value]) => {
    if (exclude.includes(key)) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((item, index) =>
        item ? (
          <input
            key={`${key}-${index}`}
            type="hidden"
            name={key}
            value={item}
          />
        ) : null,
      );
    }

    if (!value) {
      return [];
    }

    return [<input key={key} type="hidden" name={key} value={value} />];
  });
}

function summarizeTaskGroups(
  taskIds: string[],
  groups: Array<{ _count: { _all: number }; status: string; taskId: string }>,
) {
  const summaryMap = new Map<string, TaskSummary>(
    taskIds.map((taskId) => [
      taskId,
      {
        expired: 0,
        inProgress: 0,
        pending: 0,
        responseCount: 0,
        responseRate: 0,
        submitted: 0,
        total: 0,
      },
    ]),
  );

  groups.forEach((group) => {
    const summary =
      summaryMap.get(group.taskId) ??
      ({
        expired: 0,
        inProgress: 0,
        pending: 0,
        responseCount: 0,
        responseRate: 0,
        submitted: 0,
        total: 0,
      } satisfies TaskSummary);

    summary.total += group._count._all;
    summary.responseCount += 0;

    if (group.status === "PENDING") {
      summary.pending += group._count._all;
    } else if (group.status === "IN_PROGRESS") {
      summary.inProgress += group._count._all;
    } else if (group.status === "SUBMITTED") {
      summary.submitted += group._count._all;
    } else if (group.status === "EXPIRED") {
      summary.expired += group._count._all;
    }

    summary.responseRate =
      summary.total === 0 ? 0 : roundMetric((summary.submitted / summary.total) * 100);
    summaryMap.set(group.taskId, summary);
  });

  return summaryMap;
}

function summarizeTaskResponseCounts(
  taskIds: string[],
  groups: Array<{ _count: { _all: number }; taskId: string }>,
) {
  const responseCountMap = new Map<string, number>(
    taskIds.map((taskId) => [taskId, 0]),
  );

  groups.forEach((group) => {
    responseCountMap.set(group.taskId, group._count._all);
  });

  return responseCountMap;
}

function buildOrganizationClassCounts(
  organizations: OrganizationOption[],
  directClassCounts: Map<string, number>,
): OrganizationOptionView[] {
  const childrenMap = new Map<string, string[]>();

  organizations.forEach((organization) => {
    if (!organization.parentId) {
      return;
    }

    const children = childrenMap.get(organization.parentId) ?? [];
    children.push(organization.id);
    childrenMap.set(organization.parentId, children);
  });

  const subtotalCache = new Map<string, number>();

  const countForOrganization = (organizationId: string): number => {
    const cached = subtotalCache.get(organizationId);

    if (cached !== undefined) {
      return cached;
    }

    const direct = directClassCounts.get(organizationId) ?? 0;
    const childTotal = (childrenMap.get(organizationId) ?? []).reduce<number>(
      (total, childId) => total + countForOrganization(childId),
      0,
    );
    const total = direct + childTotal;

    subtotalCache.set(organizationId, total);

    return total;
  };

  return organizations
    .map((organization) => ({
      ...organization,
      classCount: countForOrganization(organization.id),
    }))
    .filter((organization) => organization.classCount > 0);
}

function PaginationControls({
  label,
  page,
  pageKey,
  searchParams,
}: {
  label: string;
  page: PageWindow;
  pageKey: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (page.totalItems <= page.pageSize) {
    return null;
  }

  const start = (page.currentPage - 1) * page.pageSize + 1;
  const end = Math.min(page.currentPage * page.pageSize, page.totalItems);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {label}：{formatInteger(start)}-{formatInteger(end)} /{" "}
        {formatInteger(page.totalItems)}
      </span>
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={page.currentPage <= 1}
          className={`rounded-md border border-slate-300 px-3 py-1.5 font-medium ${
            page.currentPage <= 1
              ? "pointer-events-none text-slate-300"
              : "text-slate-700 hover:bg-slate-50"
          }`}
          href={buildPageHref(searchParams, pageKey, Math.max(1, page.currentPage - 1))}
        >
          上一页
        </Link>
        <span className="min-w-16 text-center text-xs text-slate-500">
          {formatInteger(page.currentPage)} / {formatInteger(page.totalPages)}
        </span>
        <Link
          aria-disabled={page.currentPage >= page.totalPages}
          className={`rounded-md border border-slate-300 px-3 py-1.5 font-medium ${
            page.currentPage >= page.totalPages
              ? "pointer-events-none text-slate-300"
              : "text-slate-700 hover:bg-slate-50"
          }`}
          href={buildPageHref(
            searchParams,
            pageKey,
            Math.min(page.totalPages, page.currentPage + 1),
          )}
        >
          下一页
        </Link>
      </div>
    </div>
  );
}

function buildTaskSelectionHref(
  searchParams: Record<string, string | string[] | undefined>,
  taskId: string,
) {
  return buildHref(searchParams, {
    assignmentPage: 1,
    assignmentQ: null,
    assignmentStatus: null,
    classPage: 1,
    classQ: null,
    detailTaskId: taskId,
  });
}

function buildPageHref(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
  page: number,
) {
  return buildHref(searchParams, { [key]: page });
}

function statusAction(
  task: TaskRow,
  responseCount: number,
  assignmentCount: number,
  detailHref: string | null,
) {
  const buttonClass =
    "rounded-md px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2">
      {detailHref ? (
        <Link
          href={detailHref}
          className={`${buttonClass} border border-sky-200 text-sky-700`}
        >
          查看明细
        </Link>
      ) : null}
      {task.status === "DRAFT" ? (
        <form action={updateEvaluationTaskStatus}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="status" value="OPEN" />
          <button className={`${buttonClass} bg-emerald-600 text-white`}>
            发布
          </button>
        </form>
      ) : null}
      {task.status === "OPEN" ? (
        <form action={closeEvaluationTaskAndExpirePending}>
          <input type="hidden" name="taskId" value={task.id} />
          <button className={`${buttonClass} bg-slate-950 text-white`}>
            关闭并过期
          </button>
        </form>
      ) : null}
      {task.status === "CLOSED" ? (
        <form action={updateEvaluationTaskStatus}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="status" value="ARCHIVED" />
          <button className={`${buttonClass} border border-slate-300 text-slate-700`}>
            归档
          </button>
        </form>
      ) : null}
      {restoreTaskAction(task)}
      <form action={remindPendingEvaluationAssignments}>
        <input type="hidden" name="taskId" value={task.id} />
        <button
          disabled={assignmentCount === 0 || task.status !== "OPEN"}
          className={`${buttonClass} border border-sky-200 text-sky-700`}
        >
          催办未提交
        </button>
      </form>
      <form action={deleteEvaluationTask}>
        <input type="hidden" name="taskId" value={task.id} />
        <button
          disabled={responseCount > 0}
          className={`${buttonClass} border border-rose-200 text-rose-700`}
        >
          删除任务
        </button>
      </form>
    </div>
  );
}

function restoreTaskAction(task: TaskRow) {
  const restoredStatus = nextRestoredTaskStatus(task.status);

  if (!restoredStatus) {
    return null;
  }

  return (
    <form action={updateEvaluationTaskStatus}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="status" value={restoredStatus} />
      <button className="rounded-md border border-sky-200 px-3 py-2 text-xs font-medium text-sky-700">
        {task.status === "ARCHIVED" ? "恢复为已关闭" : "恢复进行中"}
      </button>
    </form>
  );
}

async function loadTaskOverview(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<TaskOverviewData> {
  if (!isDatabaseConfigured()) {
    return {
      assignmentCount: 0,
      expiredCount: 0,
      isDatabaseConfigured: false,
      openTaskCount: 0,
      submittedCount: 0,
      taskCount: 0,
      taskPage: paginate(0, 1, TASK_PAGE_SIZE),
      tasks: [],
      templates: [],
    };
  }

  const { prisma } = await import("@/lib/db");
  const requestedTaskPage = parsePageNumber(searchParams, "taskPage");
  const [
    taskCount,
    openTaskCount,
    assignmentCount,
    submittedCount,
    expiredCount,
    templates,
  ] = await Promise.all([
    prisma.evaluationTask.count(),
    prisma.evaluationTask.count({ where: { status: "OPEN" } }),
    prisma.evaluationAssignment.count(),
    prisma.evaluationAssignment.count({ where: { status: "SUBMITTED" } }),
    prisma.evaluationAssignment.count({ where: { status: "EXPIRED" } }),
    prisma.evaluationTemplate.findMany({
      select: { id: true, name: true, version: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { version: "desc" }],
    }),
  ]);
  const taskPage = paginate(taskCount, requestedTaskPage, TASK_PAGE_SIZE);
  const tasks = await prisma.evaluationTask.findMany({
    include: {
      template: { select: { name: true, version: true } },
    },
    orderBy: [{ term: "desc" }, { updatedAt: "desc" }],
    skip: taskPage.offset,
    take: TASK_PAGE_SIZE,
  });
  const taskIds = tasks.map((task) => task.id);

  const [statusGroups, responseGroups] = taskIds.length
    ? await Promise.all([
        prisma.evaluationAssignment.groupBy({
          by: ["taskId", "status"],
          _count: { _all: true },
          where: { taskId: { in: taskIds } },
        }),
        prisma.evaluationAssignment.groupBy({
          by: ["taskId"],
          _count: { _all: true },
          where: {
            response: { isNot: null },
            taskId: { in: taskIds },
          },
        }),
      ])
    : [[], []];
  const summaryMap = summarizeTaskGroups(taskIds, statusGroups);
  const responseCountMap = summarizeTaskResponseCounts(taskIds, responseGroups);

  return {
    assignmentCount,
    expiredCount,
    isDatabaseConfigured: true,
    openTaskCount,
    submittedCount,
    taskCount,
    taskPage,
    tasks: tasks.map((task) => {
      const summary =
        summaryMap.get(task.id) ??
        ({
          expired: 0,
          inProgress: 0,
          pending: 0,
          responseCount: responseCountMap.get(task.id) ?? 0,
          responseRate: 0,
          submitted: 0,
          total: 0,
        } satisfies TaskSummary);

      summary.responseCount = responseCountMap.get(task.id) ?? 0;

      return {
        ...task,
        summary,
      };
    }),
    templates,
  };
}

async function loadTaskDetail(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<TaskDetailData | null> {
  const detailTaskId = parseSearchText(searchParams, "detailTaskId");

  if (!detailTaskId || !isDatabaseConfigured()) {
    return null;
  }

  const { prisma } = await import("@/lib/db");
  const task = await prisma.evaluationTask.findUnique({
    select: {
      endsAt: true,
      id: true,
      name: true,
      startsAt: true,
      status: true,
      term: true,
      template: { select: { name: true, version: true } },
    },
    where: { id: detailTaskId },
  });

  if (!task) {
    return {
      assignmentPage: paginate(0, 1, ASSIGNMENT_PAGE_SIZE),
      assignments: [],
      classPage: paginate(0, 1, CLASS_PAGE_SIZE),
      classSearch: "",
      classes: [],
      detailMessage: "未找到选中的评教任务。",
      organizations: [],
      summary: null,
      task: null,
      totalAssignments: 0,
    };
  }

  if (!isTaskVisibleInRecoveryDetail(task.status)) {
    return {
      assignmentPage: paginate(0, 1, ASSIGNMENT_PAGE_SIZE),
      assignments: [],
      classPage: paginate(0, 1, CLASS_PAGE_SIZE),
      classSearch: "",
      classes: [],
      detailMessage: "该任务已关闭或归档，请先在任务列表中恢复后再查看明细。",
      organizations: [],
      summary: null,
      task,
      totalAssignments: 0,
    };
  }

  const assignmentPageNumber = parsePageNumber(searchParams, "assignmentPage");
  const assignmentStatus = parseSearchText(searchParams, "assignmentStatus");
  const assignmentQ = parseSearchText(searchParams, "assignmentQ");
  const classPageNumber = parsePageNumber(searchParams, "classPage");
  const classSearch = parseSearchText(searchParams, "classQ");
  const assignmentFilters: Prisma.EvaluationAssignmentWhereInput[] = [{ taskId: task.id }];

  if (assignmentStatuses.has(assignmentStatus)) {
    assignmentFilters.push({
      status: assignmentStatus as $Enums.AssignmentStatus,
    });
  }

  if (assignmentQ) {
    assignmentFilters.push({
      OR: [
        { evaluator: { is: { name: { contains: assignmentQ } } } },
        { evaluator: { is: { email: { contains: assignmentQ } } } },
        {
          evaluator: {
            is: {
              studentProfile: {
                is: { studentNo: { contains: assignmentQ } },
              },
            },
          },
        },
        {
          teachingClass: {
            is: {
              name: { contains: assignmentQ },
            },
          },
        },
        {
          teachingClass: {
            is: {
              course: {
                is: {
                  code: { contains: assignmentQ },
                },
              },
            },
          },
        },
        {
          teachingClass: {
            is: {
              course: {
                is: {
                  name: { contains: assignmentQ },
                },
              },
            },
          },
        },
        {
          teachingClass: {
            is: {
              teacher: {
                is: { name: { contains: assignmentQ } },
              },
            },
          },
        },
      ],
    });
  }

  const assignmentWhere: Prisma.EvaluationAssignmentWhereInput = {
    AND: assignmentFilters,
  };
  const filteredAssignmentCount = await prisma.evaluationAssignment.count({
    where: assignmentWhere,
  });
  const assignmentPage = paginate(
    filteredAssignmentCount,
    assignmentPageNumber,
    ASSIGNMENT_PAGE_SIZE,
  );
  const classFilters: Prisma.TeachingClassWhereInput[] = [{ term: task.term }];

  if (classSearch) {
    classFilters.push({
      OR: [
        { name: { contains: classSearch } },
        { course: { is: { code: { contains: classSearch } } } },
        { course: { is: { name: { contains: classSearch } } } },
        { teacher: { is: { name: { contains: classSearch } } } },
      ],
    });
  }

  const termClassWhere: Prisma.TeachingClassWhereInput = {
    AND: classFilters,
  };
  const [
    assignments,
    classCount,
    classRows,
    organizations,
    directClassCounts,
    summaryGroups,
    summaryResponseCount,
  ] = await Promise.all([
    prisma.evaluationAssignment.findMany({
      where: assignmentWhere,
      include: {
        evaluator: {
          select: {
            name: true,
            email: true,
            studentProfile: { select: { studentNo: true } },
          },
        },
        teachingClass: {
          select: {
            name: true,
            term: true,
            course: { select: { code: true, name: true } },
            teacher: { select: { name: true } },
          },
        },
        response: { select: { status: true, submittedAt: true } },
      },
      orderBy: [{ assignedAt: "desc" }],
      skip: assignmentPage.offset,
      take: ASSIGNMENT_PAGE_SIZE,
    }),
    prisma.teachingClass.count({ where: termClassWhere }),
    prisma.teachingClass.findMany({
      where: termClassWhere,
      select: {
        id: true,
        name: true,
        term: true,
        organizationId: true,
        course: { select: { code: true, name: true } },
        teacher: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ name: "asc" }],
      skip: (classPageNumber - 1) * CLASS_PAGE_SIZE,
      take: CLASS_PAGE_SIZE,
    }),
    prisma.organization.findMany({
      select: { id: true, name: true, parentId: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.teachingClass.groupBy({
      by: ["organizationId"],
      _count: { organizationId: true },
      where: { term: task.term },
    }),
    prisma.evaluationAssignment.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { taskId: task.id },
    }),
    prisma.evaluationAssignment.count({
      where: { taskId: task.id, response: { isNot: null } },
    }),
  ]);
  const classPage = paginate(classCount, classPageNumber, CLASS_PAGE_SIZE);
  const classCountMap = new Map<string, number>();

  directClassCounts.forEach((item) => {
    if (item.organizationId) {
      classCountMap.set(item.organizationId, item._count.organizationId);
    }
  });

  const organizationsWithCounts = buildOrganizationClassCounts(
    organizations,
    classCountMap,
  );
  const summary = summaryGroups.reduce<TaskSummary>(
    (acc, group) => {
      acc.total += group._count._all;

      if (group.status === "PENDING") {
        acc.pending += group._count._all;
      } else if (group.status === "IN_PROGRESS") {
        acc.inProgress += group._count._all;
      } else if (group.status === "SUBMITTED") {
        acc.submitted += group._count._all;
      } else if (group.status === "EXPIRED") {
        acc.expired += group._count._all;
      }

      acc.responseCount = summaryResponseCount;

      return acc;
    },
    {
      expired: 0,
      inProgress: 0,
      pending: 0,
      responseCount: summaryResponseCount,
      responseRate: 0,
      submitted: 0,
      total: 0,
    },
  );
  summary.responseRate =
    summary.total === 0 ? 0 : roundMetric((summary.responseCount / summary.total) * 100);

  return {
    assignmentPage,
    assignments,
    classPage,
    classSearch,
    classes: classRows,
    detailMessage: null,
    organizations: organizationsWithCounts,
    summary,
    task,
    totalAssignments: filteredAssignmentCount,
  };
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: TaskPageSearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);
  const rawSearchParams = await searchParams;
  const [overview, detail] = await Promise.all([
    loadTaskOverview(rawSearchParams),
    loadTaskDetail(rawSearchParams),
  ]);
  const detailTaskId = parseSearchText(rawSearchParams, "detailTaskId");
  const detailResetHref = buildHref(rawSearchParams, {
    assignmentPage: null,
    assignmentQ: null,
    assignmentStatus: null,
    classPage: null,
    classQ: null,
    detailTaskId: null,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">评教任务</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          任务发布与回收
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          创建评价任务，按教学班和选课名单生成学生评教派发，跟踪提交、催办和关闭归档。
        </p>
      </div>

      {!overview.isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("评教任务")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="任务概览">
        <StatCard
          label="任务总数"
          value={formatInteger(overview.taskCount)}
          hint={`${formatInteger(overview.openTaskCount)} 个进行中`}
        />
        <StatCard
          label="派发总数"
          value={formatInteger(overview.assignmentCount)}
          hint="按学生选课生成"
        />
        <StatCard
          label="已提交"
          value={formatInteger(overview.submittedCount)}
          hint={`${formatInteger(overview.expiredCount)} 条已过期`}
        />
        <StatCard
          label="整体回收率"
          value={formatPercent(
            overview.assignmentCount === 0
              ? 0
              : (overview.submittedCount / overview.assignmentCount) * 100,
          )}
          hint="按派发记录计算"
        />
      </section>

      <form
        action={createEvaluationTask}
        className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-base font-semibold text-slate-950">新建评价任务</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <label className="grid gap-1 text-sm font-medium text-slate-700 lg:col-span-2">
            任务名称
            <input
              name="name"
              required
              placeholder="例如：2026 春季学期学生评教"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!overview.isDatabaseConfigured}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            学期
            <input
              name="term"
              required
              placeholder="2025-2026-2"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!overview.isDatabaseConfigured}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            状态
            <select
              name="status"
              defaultValue="DRAFT"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!overview.isDatabaseConfigured}
            >
              <option value="DRAFT">草稿</option>
              <option value="OPEN">进行中</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            模板
            <select
              name="templateId"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!overview.isDatabaseConfigured || overview.templates.length === 0}
            >
              {overview.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} v{template.version}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            开始时间
            <input
              name="startsAt"
              type="datetime-local"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!overview.isDatabaseConfigured}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            截止时间
            <input
              name="endsAt"
              type="datetime-local"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!overview.isDatabaseConfigured}
            />
          </label>
          <div className="flex items-end lg:col-span-3">
            <button
              type="submit"
              disabled={!overview.isDatabaseConfigured || overview.templates.length === 0}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            >
              创建任务
            </button>
          </div>
        </div>
      </form>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">评价任务列表</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              首屏仅展示任务概览和统计。点击某条任务后，再加载该任务的派发与回收明细。
            </p>
          </div>
          <StatusBadge tone="info">
            {formatInteger(overview.taskPage.totalItems)} 条任务
          </StatusBadge>
        </div>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["任务", "状态", "派发", "已提交", "回收率", "操作"].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {overview.tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    暂无评教任务。
                  </td>
                </tr>
              ) : null}
              {overview.tasks.map((task) => {
                const detailHref = isTaskVisibleInRecoveryDetail(task.status)
                  ? buildTaskSelectionHref(rawSearchParams, task.id)
                  : null;

                return (
                  <tr
                    key={task.id}
                    className={
                      task.id === detailTaskId ? "bg-slate-50/70" : undefined
                    }
                  >
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{task.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {task.term} · {task.template.name} v{task.template.version}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <StatusBadge tone={taskStatusTone(task.status)}>
                        {taskStatusLabel(task.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatInteger(task.summary.total)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatInteger(task.summary.submitted)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatPercent(task.summary.responseRate)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {statusAction(
                        task,
                        task.summary.responseCount,
                        task.summary.total,
                        detailHref,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <PaginationControls
            label="任务"
            page={overview.taskPage}
            pageKey="taskPage"
            searchParams={rawSearchParams}
          />
        </div>
      </section>

      {!detail?.task ? (
        <section className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          {detailTaskId
            ? detail?.detailMessage ?? "请选择草稿或进行中的任务查看派发明细。"
            : "请选择上方一条任务查看派发明细。"}
        </section>
      ) : (
        <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">任务明细</StatusBadge>
                <StatusBadge tone={taskStatusTone(detail.task.status)}>
                  {taskStatusLabel(detail.task.status)}
                </StatusBadge>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                {detail.task.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {detail.task.term} · {detail.task.template.name} v
                {detail.task.template.version} · {formatDateTime(detail.task.startsAt)}
                - {formatDateTime(detail.task.endsAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={detailResetHref}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                返回任务列表
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="派发"
              value={formatInteger(detail.summary?.total ?? 0)}
              hint="当前任务总派发"
            />
            <StatCard
              label="已提交"
              value={formatInteger(detail.summary?.submitted ?? 0)}
              hint="已完成评教"
            />
            <StatCard
              label="已过期"
              value={formatInteger(detail.summary?.expired ?? 0)}
              hint="关闭后未提交"
            />
            <StatCard
              label="回收率"
              value={formatPercent(detail.summary?.responseRate ?? 0)}
              hint="已提交 / 派发"
            />
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <form className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_minmax(18rem,2fr)_auto_auto]">
              {preserveSearchInputs({
                exclude: ["assignmentPage", "assignmentQ", "assignmentStatus"],
                searchParams: rawSearchParams,
              })}
              <input type="hidden" name="detailTaskId" value={detail.task.id} />
              <input type="hidden" name="assignmentPage" value="1" />
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                派发状态
                <select
                  name="assignmentStatus"
                  defaultValue={parseSearchText(rawSearchParams, "assignmentStatus")}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">全部状态</option>
                  {["PENDING", "IN_PROGRESS", "SUBMITTED", "EXPIRED"].map(
                    (status) => (
                      <option key={status} value={status}>
                        {assignmentStatusLabel(status)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                关键字
                <input
                  name="assignmentQ"
                  defaultValue={parseSearchText(rawSearchParams, "assignmentQ")}
                  placeholder="学生 / 邮箱 / 学号 / 课程 / 教学班"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex items-end gap-2">
                <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                  查询
                </button>
                <Link
                  href={buildHref(rawSearchParams, {
                    assignmentPage: 1,
                    assignmentQ: null,
                    assignmentStatus: null,
                    detailTaskId: detail.task.id,
                  })}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  重置
                </Link>
              </div>
            </form>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {["学生", "课程教学班", "状态", "派发/提交时间", "操作"].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {detail.assignments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      暂无派发记录。
                    </td>
                  </tr>
                ) : null}
                {detail.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">
                        {assignment.evaluator.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {assignment.evaluator.studentProfile?.studentNo ??
                          assignment.evaluator.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">
                        {assignment.teachingClass.course.name} ·
                        {assignment.teachingClass.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {assignment.teachingClass.course.code} ·
                        {assignment.teachingClass.teacher.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {assignmentStatusLabel(assignment.status)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div>{formatDateTime(assignment.assignedAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatSubmissionStatusText(
                          assignment.response?.submittedAt ?? assignment.submittedAt,
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <form action={deleteEvaluationAssignment}>
                        <input
                          type="hidden"
                          name="assignmentId"
                          value={assignment.id}
                        />
                        <button
                          disabled={assignment.response !== null}
                          className="text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          删除
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls
            label="派发"
            page={detail.assignmentPage}
            pageKey="assignmentPage"
            searchParams={rawSearchParams}
          />

          <section className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  选择教学班生成派发
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  仅展示当前任务学期的数据。可先按组织快速选择，再补充具体教学班。
                </p>
              </div>
            </div>

            <form className="rounded-md border border-slate-200 bg-slate-50 p-4">
              {preserveSearchInputs({
                exclude: ["classPage", "classQ"],
                searchParams: rawSearchParams,
              })}
              <input type="hidden" name="detailTaskId" value={detail.task.id} />
              <input type="hidden" name="classPage" value="1" />
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  教学班关键字
                  <input
                    name="classQ"
                    defaultValue={detail.classSearch}
                    placeholder="教学班 / 课程 / 教师"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                    查询
                  </button>
                  <Link
                    href={buildHref(rawSearchParams, {
                      classPage: 1,
                      classQ: null,
                      detailTaskId: detail.task.id,
                    })}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    重置
                  </Link>
                </div>
              </div>
            </form>

            <form
              action={generateEvaluationAssignments}
              className="rounded-md border border-slate-200 bg-slate-50 p-4"
            >
              <input type="hidden" name="taskId" value={detail.task.id} />
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    当前学期可生成派发：{formatInteger(detail.classPage.totalItems)} 个教学班
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    不勾选时会按任务学期为所有有选课记录的教学班生成派发，并自动跳过已存在记录。
                  </p>
                </div>
                <button
                  disabled={detail.classes.length === 0}
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                >
                  生成派发
                </button>
              </div>

              {detail.organizations.length > 0 ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500">
                    按组织快速选择
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {detail.organizations.map((organization) => (
                      <label
                        key={organization.id}
                        className="flex gap-2 rounded-md border border-sky-100 bg-white p-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          name="organizationIds"
                          value={organization.id}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium text-slate-900">
                            {organization.name}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {organization.type} · 覆盖
                            {formatInteger(organization.classCount)} 个教学班
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 text-xs font-semibold text-slate-500">
                按教学班精确选择
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {detail.classes.map((teachingClass) => (
                  <label
                    key={teachingClass.id}
                    className="flex gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="teachingClassIds"
                      value={teachingClass.id}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-slate-900">
                        {teachingClass.course.name} · {teachingClass.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {teachingClass.term} · {teachingClass.course.code} ·
                        {teachingClass.teacher.name} ·
                        {formatInteger(teachingClass._count.enrollments)} 人选课
                      </span>
                    </span>
                  </label>
                ))}
                {detail.classes.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    当前筛选下没有可用教学班。
                  </div>
                ) : null}
              </div>
            </form>

            <PaginationControls
              label="教学班"
              page={detail.classPage}
              pageKey="classPage"
              searchParams={rawSearchParams}
            />
          </section>
        </section>
      )}
    </div>
  );
}
