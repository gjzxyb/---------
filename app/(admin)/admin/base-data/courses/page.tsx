import Link from "next/link";

import { createCourse, deleteCourse, importCourses } from "@/app/actions/base-data";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  buildCourseListHref,
  parseCourseListQuery,
  type CourseListQuery,
} from "@/lib/base-data/course-management";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type CoursesPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

async function loadData(query: CourseListQuery) {
  if (!isDatabaseConfigured()) {
    return {
      associatedCount: 0,
      courses: [],
      isDatabaseConfigured: false,
      organizations: [],
      totalCount: 0,
      totalPages: 1,
      unassociatedCount: 0,
    };
  }

  const { prisma } = await import("@/lib/db");
  const filters = [];

  if (query.q) {
    filters.push({
      OR: [
        { code: { contains: query.q } },
        { name: { contains: query.q } },
        { organization: { is: { name: { contains: query.q } } } },
      ],
    });
  }

  if (query.organizationId) {
    filters.push({ organizationId: query.organizationId });
  }

  if (query.teachingClassStatus === "WITH_CLASSES") {
    filters.push({ teachingClasses: { some: {} } });
  }

  if (query.teachingClassStatus === "WITHOUT_CLASSES") {
    filters.push({ teachingClasses: { none: {} } });
  }

  const where = filters.length > 0 ? { AND: filters } : {};
  const skip = (query.page - 1) * query.pageSize;
  const [courses, organizations, totalCount, associatedCount] = await Promise.all([
    prisma.course.findMany({
      include: {
        organization: { select: { name: true } },
        _count: { select: { teachingClasses: true } },
      },
      orderBy: { code: "asc" },
      skip,
      take: query.pageSize,
      where,
    }),
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
    prisma.course.count({ where }),
    prisma.course.count({
      where: { ...where, teachingClasses: { some: {} } },
    }),
  ]);

  return {
    associatedCount,
    courses,
    isDatabaseConfigured: true,
    organizations,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
    unassociatedCount: Math.max(0, totalCount - associatedCount),
  };
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: CoursesPageSearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);
  const query = parseCourseListQuery(await searchParams);
  const {
    associatedCount,
    courses,
    organizations,
    isDatabaseConfigured,
    totalCount,
    totalPages,
    unassociatedCount,
  } = await loadData(query);
  const currentPage = Math.min(query.page, totalPages);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">基础数据</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          课程管理
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          维护课程主数据，支持新建、批量导入、筛选、分页和删除未关联课程。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("课程")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="筛选结果" value={formatInteger(totalCount)} hint="符合当前条件的课程" />
        <StatCard label="已关联教学班" value={formatInteger(associatedCount)} hint="至少有 1 个教学班" />
        <StatCard label="未关联课程" value={formatInteger(unassociatedCount)} hint="可直接删除" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form action={createCourse} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">新建课程</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
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

        <form action={importCourses} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">批量导入课程</h2>
              <p className="mt-1 text-sm text-slate-600">
                支持 CSV，字段为课程代码、课程名称、组织。
              </p>
            </div>
            <Link href="/admin/base-data/courses/import-template" className="text-sm font-medium text-sky-700">
              下载 CSV 模板
            </Link>
          </div>
          <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
            导入文件
            <input name="file" type="file" accept=".csv,text/csv" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured} />
          </label>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            组织可填写组织名称或组织 ID；课程代码重复、组织无法匹配的行会自动跳过。
          </p>
          <button className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!isDatabaseConfigured}>
            导入课程
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="p-5">
          <input type="hidden" name="page" value="1" />
          <h2 className="text-base font-semibold text-slate-950">筛选课程</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_180px_140px_auto]">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              关键词
              <input name="q" defaultValue={query.q ?? ""} placeholder="课程代码 / 名称 / 组织" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              归属组织
              <select name="organizationId" defaultValue={query.organizationId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部组织</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              关联状态
              <select name="teachingClassStatus" defaultValue={query.teachingClassStatus} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="ALL">全部课程</option>
                <option value="WITH_CLASSES">已关联教学班</option>
                <option value="WITHOUT_CLASSES">未关联教学班</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              每页
              <select name="pageSize" defaultValue={String(query.pageSize)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="30">30 条</option>
                <option value="60">60 条</option>
                <option value="100">100 条</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                查询
              </button>
              <Link href="/admin/base-data/courses" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                重置
              </Link>
            </div>
          </div>
        </form>

        <div className="border-t border-slate-200">
          <DataTable
            headers={["课程", "归属组织", "教学班数", "状态", "操作"]}
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
                <StatusBadge key="status" tone={canDelete ? "neutral" : "success"}>
                  {canDelete ? "未关联" : "已关联"}
                </StatusBadge>,
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

        <nav className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            共 {formatInteger(totalCount)} 条，当前第 {formatInteger(currentPage)} / {formatInteger(totalPages)} 页。
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={currentPage <= 1}
              href={buildCourseListHref(query, {
                page: Math.max(1, currentPage - 1),
              })}
              className={`rounded-md border px-3 py-2 font-medium ${
                currentPage <= 1
                  ? "pointer-events-none border-slate-200 text-slate-300"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              上一页
            </Link>
            <Link
              aria-disabled={currentPage >= totalPages}
              href={buildCourseListHref(query, {
                page: Math.min(totalPages, currentPage + 1),
              })}
              className={`rounded-md border px-3 py-2 font-medium ${
                currentPage >= totalPages
                  ? "pointer-events-none border-slate-200 text-slate-300"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              下一页
            </Link>
          </div>
        </nav>
      </section>
    </div>
  );
}
