import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import { appCachePrefixes, cachedJson } from "@/lib/cache/app-cache";
import {
  ADMIN_ROLES,
  assignmentResponseRate,
  countSubmitted,
  emptyWhenDatabaseMissing,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
  taskStatusLabel,
  taskStatusTone,
  termTrendSummary,
} from "@/lib/demo-data";

const LOW_RESPONSE_RATE = 60;

type AdminDashboardTask = {
  id: string;
  name: string;
  term: string;
  status: string;
  assignments: {
    status: string;
    submittedAt: Date | null;
    response: { status: string } | null;
  }[];
};

type DashboardData = {
  tasks: AdminDashboardTask[];
  totalCourses: number;
  participatingStudents: number;
  isDatabaseConfigured: boolean;
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
      tasks: [],
      totalCourses: 0,
      participatingStudents: 0,
      isDatabaseConfigured: false,
    };
  }

  const { prisma } = await import("@/lib/db");
  const [tasks, totalCourses, participatingStudentRows] = await Promise.all([
    prisma.evaluationTask.findMany({
      include: {
        assignments: {
          select: {
            status: true,
            submittedAt: true,
            response: { select: { status: true } },
          },
        },
      },
      orderBy: [{ term: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.course.count(),
    prisma.evaluationAssignment.findMany({
      distinct: ["evaluatorId"],
      select: { evaluatorId: true },
    }),
  ]);

  return {
    tasks,
    totalCourses,
    participatingStudents: participatingStudentRows.length,
    isDatabaseConfigured: true,
  };
}

export default async function AdminDashboardPage() {
  await requireRole([...ADMIN_ROLES]);
  const { tasks, totalCourses, participatingStudents, isDatabaseConfigured } =
    await loadDashboardData();
  const totalAssignments = tasks.reduce(
    (total, task) => total + task.assignments.length,
    0,
  );
  const submittedAssignments = tasks.reduce(
    (total, task) => total + countSubmitted(task.assignments),
    0,
  );
  const lowResponseTasks = tasks.filter(
    (task) =>
      task.status === "OPEN" &&
      task.assignments.length > 0 &&
      assignmentResponseRate(task.assignments) < LOW_RESPONSE_RATE,
  );
  const trendTerms = Array.from(
    tasks
      .reduce<Map<string, AdminDashboardTask["assignments"]>>((terms, task) => {
        terms.set(task.term, [...(terms.get(task.term) ?? []), ...task.assignments]);
        return terms;
      }, new Map())
      .entries(),
  ).map(([term, assignments]) => ({ term, assignments }));

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
        <StatCard label="评教任务" value={formatInteger(tasks.length)} hint="全部任务数量" />
        <StatCard label="课程总数" value={formatInteger(totalCourses)} hint="基础课程库" />
        <StatCard
          label="参与学生"
          value={formatInteger(participatingStudents)}
          hint="被派发评教的去重学生"
        />
        <StatCard
          label="整体回收率"
          value={formatPercent(assignmentResponseRate(tasks.flatMap((task) => task.assignments)))}
          hint={`${formatInteger(submittedAssignments)} / ${formatInteger(totalAssignments)} 已提交`}
        />
        <StatCard
          label="低回收预警"
          value={formatInteger(lowResponseTasks.length)}
          hint={`开放任务低于 ${LOW_RESPONSE_RATE}%`}
        />
        <StatCard label="学期趋势" value="趋势" hint={termTrendSummary(trendTerms)} />
      </section>

      <DataTable
        headers={["任务", "学期", "状态", "派发", "已提交", "回收率"]}
        emptyText="暂无评教任务。"
        rows={tasks.slice(0, 8).map((task) => [
          <div key="task">
            <div className="font-medium text-slate-900">{task.name}</div>
            {lowResponseTasks.some((item) => item.id === task.id) ? (
              <div className="mt-1 text-xs text-amber-700">低回收率预警</div>
            ) : null}
          </div>,
          task.term,
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
