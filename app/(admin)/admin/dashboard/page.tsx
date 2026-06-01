import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import { appCachePrefixes, cachedJson } from "@/lib/cache/app-cache";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
  percentage,
  taskStatusLabel,
  taskStatusTone,
} from "@/lib/demo-data";

const LOW_RESPONSE_RATE = 60;

type AdminDashboardTask = {
  id: string;
  name: string;
  term: string;
  status: string;
  responseRate: number;
  submittedAssignments: number;
  totalAssignments: number;
};

type DashboardData = {
  isDatabaseConfigured: boolean;
  lowResponseTaskCount: number;
  participatingStudents: number;
  recentTasks: AdminDashboardTask[];
  submittedAssignments: number;
  taskCount: number;
  totalCourses: number;
  totalAssignments: number;
  trendSummary: string;
};

async function loadDashboardData(): Promise<DashboardData> {
  return cachedJson({
    key: `${appCachePrefixes.adminDashboard}overview`,
    loader: loadFreshDashboardData,
    ttlSeconds: 60,
  });
}

async function loadFreshDashboardData(): Promise<DashboardData> {
  if (!isDatabaseConfigured()) {
    return {
      isDatabaseConfigured: false,
      lowResponseTaskCount: 0,
      participatingStudents: 0,
      recentTasks: [],
      submittedAssignments: 0,
      taskCount: 0,
      totalAssignments: 0,
      totalCourses: 0,
      trendSummary: "暂无学期趋势数据",
    };
  }

  const { prisma } = await import("@/lib/db");
  const [tasks, totalCourses, totalGroups, submittedGroups, participatingRows] =
    await Promise.all([
      prisma.evaluationTask.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          term: true,
        },
        orderBy: [{ term: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.course.count(),
      prisma.evaluationAssignment.groupBy({
        by: ["taskId"],
        _count: { _all: true },
      }),
      prisma.evaluationAssignment.groupBy({
        by: ["taskId"],
        _count: { _all: true },
        where: {
          OR: [
            { status: "SUBMITTED" },
            { submittedAt: { not: null } },
            { response: { status: "SUBMITTED" } },
          ],
        },
      }),
      prisma.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(DISTINCT "evaluatorId")::int AS count
        FROM "EvaluationAssignment"
      `,
    ]);

  const totalByTask = new Map(
    totalGroups.map((group) => [group.taskId, group._count._all]),
  );
  const submittedByTask = new Map(
    submittedGroups.map((group) => [group.taskId, group._count._all]),
  );
  const taskSummaries = tasks.map((task) => {
    const totalAssignments = totalByTask.get(task.id) ?? 0;
    const submittedAssignments = submittedByTask.get(task.id) ?? 0;

    return {
      ...task,
      responseRate: percentage(submittedAssignments, totalAssignments),
      submittedAssignments,
      totalAssignments,
    };
  });
  const totalAssignments = taskSummaries.reduce(
    (total, task) => total + task.totalAssignments,
    0,
  );
  const submittedAssignments = taskSummaries.reduce(
    (total, task) => total + task.submittedAssignments,
    0,
  );
  const termBuckets = new Map<string, { submitted: number; total: number }>();

  taskSummaries.forEach((task) => {
    const bucket = termBuckets.get(task.term) ?? { submitted: 0, total: 0 };
    bucket.submitted += task.submittedAssignments;
    bucket.total += task.totalAssignments;
    termBuckets.set(task.term, bucket);
  });

  const sortedTerms = Array.from(termBuckets.entries()).sort(([first], [second]) =>
    second.localeCompare(first),
  );
  const trendSummary = (() => {
    if (sortedTerms.length === 0) {
      return "暂无学期趋势数据";
    }

    const [currentTerm, previousTerm] = sortedTerms;
    const currentRate = percentage(currentTerm[1].submitted, currentTerm[1].total);

    if (!previousTerm) {
      return `${currentTerm[0]} 回收率 ${formatPercent(currentRate)}`;
    }

    const previousRate = percentage(previousTerm[1].submitted, previousTerm[1].total);
    const delta = Number((currentRate - previousRate).toFixed(2));
    const direction = delta >= 0 ? "提升" : "下降";

    return `${currentTerm[0]} 回收率 ${formatPercent(currentRate)}，较 ${previousTerm[0]} ${direction} ${formatPercent(Math.abs(delta))}`;
  })();

  return {
    isDatabaseConfigured: true,
    lowResponseTaskCount: taskSummaries.filter(
      (task) =>
        task.status === "OPEN" &&
        task.totalAssignments > 0 &&
        task.responseRate < LOW_RESPONSE_RATE,
    ).length,
    participatingStudents: Number(participatingRows[0]?.count ?? 0),
    recentTasks: taskSummaries.slice(0, 8),
    submittedAssignments,
    taskCount: tasks.length,
    totalAssignments,
    totalCourses,
    trendSummary,
  };
}

export default async function AdminDashboardPage() {
  await requireRole([...ADMIN_ROLES]);
  const {
    isDatabaseConfigured,
    lowResponseTaskCount,
    participatingStudents,
    recentTasks,
    submittedAssignments,
    taskCount,
    totalAssignments,
    totalCourses,
    trendSummary,
  } = await loadDashboardData();
  const overallResponseRate = percentage(submittedAssignments, totalAssignments);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">管理中心</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          管理看板
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          汇总评教任务、课程覆盖、学生参与和本学期回收趋势，帮助管理员快速定位低回收风险。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("管理看板")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6" aria-label="关键指标">
        <StatCard label="评教任务" value={formatInteger(taskCount)} hint="全部任务数量" />
        <StatCard label="课程总数" value={formatInteger(totalCourses)} hint="基础课程库" />
        <StatCard
          label="参与学生"
          value={formatInteger(participatingStudents)}
          hint="被派发评教的去重学生"
        />
        <StatCard
          label="整体回收率"
          value={formatPercent(overallResponseRate)}
          hint={`${formatInteger(submittedAssignments)} / ${formatInteger(totalAssignments)} 已提交`}
        />
        <StatCard
          label="低回收预警"
          value={formatInteger(lowResponseTaskCount)}
          hint={`开放任务低于 ${LOW_RESPONSE_RATE}%`}
        />
        <StatCard label="学期趋势" value="趋势" hint={trendSummary} />
      </section>

      <DataTable
        headers={["任务", "学期", "状态", "派发", "已提交", "回收率"]}
        emptyText="暂无评教任务。"
        rows={recentTasks.map((task) => [
          <div key="task">
            <div className="font-medium text-slate-900">{task.name}</div>
            {task.status === "OPEN" &&
            task.totalAssignments > 0 &&
            task.responseRate < LOW_RESPONSE_RATE ? (
              <div className="mt-1 text-xs text-amber-700">低回收率预警</div>
            ) : null}
          </div>,
          task.term,
          <StatusBadge key="status" tone={taskStatusTone(task.status)}>
            {taskStatusLabel(task.status)}
          </StatusBadge>,
          formatInteger(task.totalAssignments),
          formatInteger(task.submittedAssignments),
          formatPercent(task.responseRate),
        ])}
      />
    </div>
  );
}
