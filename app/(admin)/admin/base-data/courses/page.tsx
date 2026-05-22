import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { createCourse, deleteCourse } from "@/app/actions/base-data";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

async function loadData() {
  if (!isDatabaseConfigured()) {
    return { courses: [], organizations: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const [courses, organizations] = await Promise.all([
    prisma.course.findMany({
      include: {
        organization: { select: { name: true } },
        _count: { select: { teachingClasses: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
  ]);

  return { courses, organizations, isDatabaseConfigured: true };
}

export default async function CoursesPage() {
  await requireRole([...ADMIN_ROLES]);
  const { courses, organizations, isDatabaseConfigured } = await loadData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">基础数据</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          课程管理
        </h1>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("课程")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="课程总数" value={formatInteger(courses.length)} hint="全部课程" />
        <StatCard label="已归属" value={formatInteger(courses.filter((item) => item.organization).length)} hint="有组织归属" />
        <StatCard label="教学班关联" value={formatInteger(courses.reduce((sum, item) => sum + item._count.teachingClasses, 0))} hint="教学班数量" />
      </section>

      <form action={createCourse} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">新建课程</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            课程编码
            <input name="code" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            课程名称
            <input name="name" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            归属组织
            <select name="organizationId" className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured}>
              <option value="">未归属</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <button className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!isDatabaseConfigured}>
            创建课程
          </button>
        </div>
      </form>

      <DataTable
        headers={["课程", "归属组织", "教学班数", "操作"]}
        emptyText="暂无课程数据。"
        rows={courses.map((course) => {
          const canDelete = course._count.teachingClasses === 0;

          return [
            <div key="course">
              <div className="font-medium text-slate-900">{course.name}</div>
              <div className="mt-1 text-xs text-slate-500">{course.code}</div>
            </div>,
            course.organization?.name ?? "未归属",
            formatInteger(course._count.teachingClasses),
            <form key="delete" action={deleteCourse}>
              <input type="hidden" name="id" value={course.id} />
              <button disabled={!canDelete} title={canDelete ? "删除课程" : "已有教学班，不可删除"} className="text-sm font-medium text-rose-700 disabled:text-slate-400">
                删除
              </button>
            </form>,
          ];
        })}
      />
    </div>
  );
}
