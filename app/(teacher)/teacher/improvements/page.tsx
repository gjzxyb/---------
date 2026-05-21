import {
  createImprovementPlan,
  updateImprovementPlanStatus,
} from "@/app/actions/improvements";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";

type TeacherImprovementClass = {
  id: string;
  name: string;
  term: string;
  course: { name: string; code: string };
};

type TeacherImprovementPlan = {
  id: string;
  title: string;
  action: string;
  status: string;
  dueDate: Date | null;
  evidence: string | null;
  teachingClass: TeacherImprovementClass;
};

type TeacherImprovementsData = {
  classes: TeacherImprovementClass[];
  plans: TeacherImprovementPlan[];
  isDatabaseConfigured: boolean;
};

const statuses = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

async function loadTeacherImprovements(
  teacherId: string,
): Promise<TeacherImprovementsData> {
  if (!process.env.DATABASE_URL) {
    return { classes: [], plans: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const [classes, plans] = await Promise.all([
    prisma.teachingClass.findMany({
      where: { teacherId },
      include: { course: true },
      orderBy: [{ term: "desc" }, { name: "asc" }],
    }),
    prisma.improvementPlan.findMany({
      where: { teacherId },
      include: {
        teachingClass: {
          include: { course: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  return { classes, plans, isDatabaseConfigured: true };
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

function statusTone(status: string) {
  if (status === "COMPLETED") {
    return "success" as const;
  }

  if (status === "CANCELLED") {
    return "neutral" as const;
  }

  return "warning" as const;
}

export default async function TeacherImprovementsPage() {
  const session = await requireRole(["TEACHER"]);
  const { classes, plans, isDatabaseConfigured } =
    await loadTeacherImprovements(session.user.id);
  const activePlanCount = plans.filter((plan) =>
    ["OPEN", "IN_PROGRESS"].includes(plan.status),
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <StatusBadge tone="info">教学改进</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          改进计划
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          记录评价结果后的整改行动、截止日期和佐证材料。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载或创建改进计划。
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="改进概览">
        <StatCard label="授课班级" value={classes.length} hint="可绑定班级" />
        <StatCard label="计划总数" value={plans.length} hint="本人创建计划" />
        <StatCard label="推进中" value={activePlanCount} hint="开放或进行中" />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">新建计划</h2>
        <form action={createImprovementPlan} className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            课程班
            <select
              name="teachingClassId"
              required
              disabled={!isDatabaseConfigured || classes.length === 0}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">请选择课程班</option>
              {classes.map((teachingClass) => (
                <option key={teachingClass.id} value={teachingClass.id}>
                  {teachingClass.term} · {teachingClass.course.name} ·{" "}
                  {teachingClass.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              标题
              <input
                name="title"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              截止日期
              <input
                name="deadline"
                type="date"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            行动
            <textarea
              name="action"
              required
              rows={3}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            佐证
            <textarea
              name="evidence"
              rows={2}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={!isDatabaseConfigured || classes.length === 0}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              创建计划
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">计划列表</h2>
        <DataTable
          headers={["课程班", "计划", "状态", "截止日期", "佐证", "更新状态"]}
          emptyText="暂无改进计划。"
        >
          <tbody className="divide-y divide-slate-100 bg-white">
            {plans.length ? (
              plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">
                      {plan.teachingClass.course.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {plan.teachingClass.course.code} ·{" "}
                      {plan.teachingClass.name} · {plan.teachingClass.term}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">
                      {plan.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {plan.action}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <StatusBadge tone={statusTone(plan.status)}>
                      {plan.status}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {formatDate(plan.dueDate)}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {plan.evidence ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <form
                      action={updateImprovementPlanStatus}
                      className="flex gap-2"
                    >
                      <input type="hidden" name="planId" value={plan.id} />
                      <select
                        name="status"
                        defaultValue={plan.status}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        保存
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  暂无改进计划。
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </section>
    </div>
  );
}
