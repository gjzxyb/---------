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
  countSubmitted,
  emptyWhenDatabaseMissing,
  formatDateTime,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
  taskStatusLabel,
  taskStatusTone,
} from "@/lib/demo-data";
import {
  formatSubmissionStatusText,
  isTaskVisibleInRecoveryDetail,
  nextRestoredTaskStatus,
  summarizeAssignmentsByStatus,
} from "@/lib/evaluation/task-publishing";

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

type TaskRow = {
  id: string;
  name: string;
  term: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  template: { name: string; version: number };
  assignments: TaskAssignmentRow[];
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

type TaskData = {
  tasks: TaskRow[];
  templates: { id: string; name: string; version: number; isActive: boolean }[];
  teachingClasses: TeachingClassOption[];
  organizations: OrganizationOption[];
  isDatabaseConfigured: boolean;
};

async function loadTaskData(): Promise<TaskData> {
  if (!isDatabaseConfigured()) {
    return {
      tasks: [],
      templates: [],
      teachingClasses: [],
      organizations: [],
      isDatabaseConfigured: false,
    };
  }

  const { prisma } = await import("@/lib/db");
  const [tasks, templates, teachingClasses, organizations] = await Promise.all([
    prisma.evaluationTask.findMany({
      include: {
        template: { select: { name: true, version: true } },
        assignments: {
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
        },
      },
      orderBy: [{ term: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.evaluationTemplate.findMany({
      select: { id: true, name: true, version: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { version: "desc" }],
    }),
    prisma.teachingClass.findMany({
      select: {
        id: true,
        name: true,
        term: true,
        organizationId: true,
        course: { select: { code: true, name: true } },
        teacher: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ term: "desc" }, { name: "asc" }],
    }),
    prisma.organization.findMany({
      select: { id: true, name: true, parentId: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    tasks,
    templates,
    teachingClasses,
    organizations,
    isDatabaseConfigured: true,
  };
}

function statusAction(
  task: TaskRow,
  responseCount: number,
  assignmentCount: number,
) {
  const buttonClass =
    "rounded-md px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-2">
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

function collectOrganizationScopeIds(
  organizationId: string,
  organizations: OrganizationOption[],
) {
  const scopeIds = new Set([organizationId]);
  let foundNewChild = true;

  while (foundNewChild) {
    foundNewChild = false;

    organizations.forEach((organization) => {
      if (
        organization.parentId &&
        scopeIds.has(organization.parentId) &&
        !scopeIds.has(organization.id)
      ) {
        scopeIds.add(organization.id);
        foundNewChild = true;
      }
    });
  }

  return scopeIds;
}

function organizationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    CLASS: "班级",
    DEPARTMENT: "院系",
    SCHOOL: "学校",
  };

  return labels[type] ?? type;
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
      <button className="text-sm font-medium text-sky-700">
        {task.status === "ARCHIVED" ? "恢复为已关闭" : "恢复进行中"}
      </button>
    </form>
  );
}

export default async function AdminTasksPage() {
  await requireRole([...ADMIN_ROLES]);
  const {
    tasks,
    templates,
    teachingClasses,
    organizations,
    isDatabaseConfigured,
  } = await loadTaskData();
  const openTasks = tasks.filter((task) => task.status === "OPEN").length;
  const allAssignments = tasks.flatMap((task) => task.assignments);
  const assignmentCount = allAssignments.length;
  const submittedCount = countSubmitted(allAssignments);
  const expiredCount = allAssignments.filter(
    (assignment) => assignment.status === "EXPIRED",
  ).length;
  const detailTasks = tasks.filter((task) =>
    isTaskVisibleInRecoveryDetail(task.status),
  );

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

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("评教任务")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="任务概览">
        <StatCard label="任务总数" value={formatInteger(tasks.length)} hint={`${formatInteger(openTasks)} 个进行中`} />
        <StatCard label="派发总数" value={formatInteger(assignmentCount)} hint="按学生选课生成" />
        <StatCard label="已提交" value={formatInteger(submittedCount)} hint={`${formatInteger(expiredCount)} 条已过期`} />
        <StatCard label="整体回收率" value={formatPercent(assignmentCount === 0 ? 0 : (submittedCount / assignmentCount) * 100)} hint="按派发记录计算" />
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
              disabled={!isDatabaseConfigured}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            学期
            <input
              name="term"
              required
              placeholder="2025-2026-2"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!isDatabaseConfigured}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            状态
            <select
              name="status"
              defaultValue="DRAFT"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!isDatabaseConfigured}
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
              disabled={!isDatabaseConfigured || templates.length === 0}
            >
              {templates.map((template) => (
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
              disabled={!isDatabaseConfigured}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            截止时间
            <input
              name="endsAt"
              type="datetime-local"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!isDatabaseConfigured}
            />
          </label>
          <div className="flex items-end lg:col-span-3">
            <button
              type="submit"
              disabled={!isDatabaseConfigured || templates.length === 0}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            >
              创建任务
            </button>
          </div>
        </div>
      </form>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">评价任务列表</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          汇总全部评价任务状态。已关闭和已归档任务不会显示在下方回收明细中，可在这里恢复。
        </p>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["任务", "状态", "派发", "已提交", "回收率", "操作"].map(
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
              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    暂无评教任务。
                  </td>
                </tr>
              ) : null}
              {tasks.map((task) => {
                const summary = summarizeAssignmentsByStatus(task.assignments);

                return (
                  <tr key={task.id}>
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
                      {formatInteger(summary.total)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatInteger(summary.submitted)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatPercent(summary.responseRate)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {restoreTaskAction(task) ?? (
                        <span className="text-xs text-slate-400">无需恢复</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">任务派发与回收明细</h2>
          <p className="mt-1 text-sm text-slate-600">
            不选择教学班时，系统会按任务学期为所有有选课记录的教学班生成派发，并自动跳过已存在的派发记录。
          </p>
        </div>

        {detailTasks.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            暂无草稿或进行中的任务。已关闭和已归档任务可在上方评价任务列表中恢复。
          </div>
        ) : null}

        {detailTasks.map((task) => {
          const summary = summarizeAssignmentsByStatus(task.assignments);
          const responseCount = task.assignments.filter(
            (assignment) => assignment.response !== null,
          ).length;
          const termTeachingClasses = teachingClasses.filter(
            (teachingClass) => teachingClass.term === task.term,
          );
          const classOptions =
            termTeachingClasses.length > 0 ? termTeachingClasses : teachingClasses;
          const organizationOptions = organizations
            .map((organization) => {
              const scopeIds = collectOrganizationScopeIds(
                organization.id,
                organizations,
              );
              const classCount = classOptions.filter(
                (teachingClass) =>
                  teachingClass.organizationId &&
                  scopeIds.has(teachingClass.organizationId),
              ).length;

              return { ...organization, classCount };
            })
            .filter((organization) => organization.classCount > 0);

          return (
            <article
              key={task.id}
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">
                      {task.name}
                    </h3>
                    <StatusBadge tone={taskStatusTone(task.status)}>
                      {taskStatusLabel(task.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {task.term} · {task.template.name} v{task.template.version} ·
                    {formatDateTime(task.startsAt)} - {formatDateTime(task.endsAt)}
                  </p>
                </div>
                {statusAction(task, responseCount, task.assignments.length)}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="派发" value={formatInteger(summary.total)} hint="全部记录" />
                <StatCard label="待填写" value={formatInteger(summary.pending)} hint="未填写" />
                <StatCard label="填写中" value={formatInteger(summary.inProgress)} hint="草稿状态" />
                <StatCard label="已提交" value={formatInteger(summary.submitted)} hint="纳入回收率" />
                <StatCard label="已过期" value={formatInteger(summary.expired)} hint="关闭后未提交" />
                <StatCard label="回收率" value={formatPercent(summary.responseRate)} hint="已提交 / 派发" />
              </div>

              <form
                action={generateEvaluationAssignments}
                className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4"
              >
                <input type="hidden" name="taskId" value={task.id} />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      选择教学班生成派发
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      可先选学校或院系快速覆盖下级教学班，也可继续勾选具体教学班；若不勾选则按任务学期全部教学班生成。
                    </p>
                  </div>
                  <button
                    disabled={classOptions.length === 0}
                    className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                  >
                    生成派发
                  </button>
                </div>
                {organizationOptions.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-slate-500">
                      按组织快速选择
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {organizationOptions.map((organization) => (
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
                              {organizationTypeLabel(organization.type)} · 覆盖
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
                  {classOptions.map((teachingClass) => (
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
                  {classOptions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                      暂无教学班或选课数据，请先在基础数据中维护教学班与选课。
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
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
                    {task.assignments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-slate-500"
                        >
                          暂无派发记录。
                        </td>
                      </tr>
                    ) : null}
                    {task.assignments.map((assignment) => (
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
                              assignment.response?.submittedAt ??
                                assignment.submittedAt,
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
            </article>
          );
        })}
      </section>
    </div>
  );
}
