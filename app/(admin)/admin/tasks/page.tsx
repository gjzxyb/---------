import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  assignmentResponseRate,
  countSubmitted,
  emptyWhenDatabaseMissing,
  formatDateTime,
  formatDateWindow,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
  taskStatusLabel,
  taskStatusTone,
} from "@/lib/demo-data";

type TaskRow = {
  id: string;
  name: string;
  term: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  template: { name: string; version: number };
  assignments: {
    status: string;
    submittedAt: Date | null;
    response: { status: string } | null;
  }[];
};

type TaskData = {
  tasks: TaskRow[];
  isDatabaseConfigured: boolean;
};

async function loadTaskData(): Promise<TaskData> {
  if (!isDatabaseConfigured()) {
    return { tasks: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const tasks = await prisma.evaluationTask.findMany({
    include: {
      template: { select: { name: true, version: true } },
      assignments: {
        select: {
          status: true,
          submittedAt: true,
          response: { select: { status: true } },
        },
      },
    },
    orderBy: [{ term: "desc" }, { updatedAt: "desc" }],
  });

  return { tasks, isDatabaseConfigured: true };
}

function publishPanelText(task: TaskRow | undefined) {
  if (!task) {
    return "暂无任务可供发布控制面板展示。";
  }

  if (task.status === "DRAFT") {
    return "当前任务仍为草稿，首版仅展示发布前检查状态。";
  }

  if (task.status === "OPEN") {
    return "当前任务正在收集中，首版发布控制为只读状态。";
  }

  if (task.status === "CLOSED") {
    return "当前任务已关闭，首版仅展示关闭后的回收结果。";
  }

  return "当前任务已归档，首版不提供重新发布操作。";
}

export default async function AdminTasksPage() {
  await requireRole([...ADMIN_ROLES]);
  const { tasks, isDatabaseConfigured } = await loadTaskData();
  const openTasks = tasks.filter((task) => task.status === "OPEN").length;
  const assignmentCount = tasks.reduce(
    (total, task) => total + task.assignments.length,
    0,
  );
  const submittedCount = tasks.reduce(
    (total, task) => total + countSubmitted(task.assignments),
    0,
  );
  const focusedTask = tasks.find((task) => task.status === "OPEN") ?? tasks[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">评教任务</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          任务发布与回收
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          查看评教任务时间窗口、发布状态、派发规模和提交进度。发布控制首版为只读面板。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("评教任务")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="任务概览">
        <StatCard label="任务总数" value={formatInteger(tasks.length)} hint={`${formatInteger(openTasks)} 个进行中`} />
        <StatCard label="派发总数" value={formatInteger(assignmentCount)} hint="全部任务派发记录" />
        <StatCard label="已提交" value={formatInteger(submittedCount)} hint="已提交评价记录" />
        <StatCard label="整体回收率" value={formatPercent(assignmentCount === 0 ? 0 : (submittedCount / assignmentCount) * 100)} hint="按派发记录计算" />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">发布控制面板</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {publishPanelText(focusedTask)}
            </p>
            {focusedTask ? (
              <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-slate-500">任务</dt>
                  <dd className="mt-1 font-medium text-slate-950">{focusedTask.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">状态</dt>
                  <dd className="mt-1">
                    <StatusBadge tone={taskStatusTone(focusedTask.status)}>
                      {taskStatusLabel(focusedTask.status)}
                    </StatusBadge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">时间窗口</dt>
                  <dd className="mt-1">
                    {formatDateTime(focusedTask.startsAt)} - {formatDateTime(focusedTask.endsAt)}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="首版只读，暂不支持发布或关闭任务"
              className="rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
            >
              首版只读
            </button>
          </div>
        </div>
      </section>

      <DataTable
        headers={["任务", "时间窗口", "状态", "派发", "已提交", "回收率"]}
        emptyText="暂无评教任务。"
        rows={tasks.map((task) => [
          <div key="task">
            <div className="font-medium text-slate-900">{task.name}</div>
            <div className="mt-1 text-xs text-slate-500">
              {task.term} · {task.template.name} v{task.template.version}
            </div>
          </div>,
          formatDateWindow(task.startsAt, task.endsAt),
          <StatusBadge key="status" tone={taskStatusTone(task.status)}>
            {taskStatusLabel(task.status)}
          </StatusBadge>,
          formatInteger(task.assignments.length),
          formatInteger(countSubmitted(task.assignments)),
          formatPercent(assignmentResponseRate(task.assignments)),
        ])}
      />
    </div>
  );
}
