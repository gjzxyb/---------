import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  createTeacher,
  importTeachersWithState,
} from "@/app/actions/base-data";
import { BaseDataImportForm } from "@/app/(admin)/admin/base-data/BaseDataImportForm";
import { TeacherListTable } from "@/app/(admin)/admin/base-data/teachers/TeacherListTable";
import { requireRole } from "@/lib/auth/guards";
import { parseTeacherListQuery } from "@/lib/base-data/teacher-import";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type TeachersPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function uniqueValues(values: Array<string | null>) {
  return Array.from(
    new Set(values.flatMap((value) => (value ? [value] : []))),
  ).sort((first, second) => first.localeCompare(second, "zh-CN"));
}

function buildTeachersHref(
  query: ReturnType<typeof parseTeacherListQuery>,
  updates: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  const merged = { ...query, ...updates };

  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();

  return queryString
    ? `/admin/base-data/teachers?${queryString}`
    : "/admin/base-data/teachers";
}

async function loadData(query: ReturnType<typeof parseTeacherListQuery>) {
  if (!isDatabaseConfigured()) {
    return {
      activeCount: 0,
      isDatabaseConfigured: false,
      organizations: [],
      teachers: [],
      titles: [],
      totalCount: 0,
      totalPages: 1,
    };
  }

  const { prisma } = await import("@/lib/db");
  const andFilters = [];

  if (query.q) {
    andFilters.push({
      OR: [
        { name: { contains: query.q } },
        { email: { contains: query.q } },
        { teacherProfile: { is: { teacherNo: { contains: query.q } } } },
      ],
    });
  }

  if (query.organizationId) {
    andFilters.push({ organizationId: query.organizationId });
  }

  if (query.status) {
    andFilters.push({ status: query.status });
  }

  if (query.title) {
    andFilters.push({ teacherProfile: { is: { title: query.title } } });
  }

  const where = {
    role: "TEACHER" as const,
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;

  const [
    teachers,
    organizations,
    totalCount,
    activeCount,
    teacherProfiles,
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        organization: { select: { name: true } },
        teacherProfile: true,
        _count: { select: { taughtClasses: true } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      skip,
      take: query.pageSize,
      where,
    }),
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.teacherProfile.findMany({
      select: { title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return {
    activeCount,
    isDatabaseConfigured: true,
    organizations,
    teachers,
    titles: uniqueValues(teacherProfiles.map((profile) => profile.title)),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
  };
}

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: TeachersPageSearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);
  const query = parseTeacherListQuery(await searchParams);
  const {
    activeCount,
    isDatabaseConfigured,
    organizations,
    teachers,
    titles,
    totalCount,
    totalPages,
  } = await loadData(query);
  const currentPage = Math.min(query.page, totalPages);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">基础数据</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          教师管理
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          新建和导入账号默认密码为 Password123!。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("教师")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="筛选结果"
          value={formatInteger(totalCount)}
          hint="符合当前条件的教师"
        />
        <StatCard
          label="启用账号"
          value={formatInteger(activeCount)}
          hint="当前条件下可登录"
        />
        <StatCard
          label="本页授课班级"
          value={formatInteger(
            teachers.reduce((sum, item) => sum + item._count.taughtClasses, 0),
          )}
          hint="当前页教师任课数"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form
          action={createTeacher}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-950">新建教师</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              ["姓名", "name"],
              ["邮箱", "email"],
              ["工号", "teacherNo"],
              ["职称", "title"],
            ].map(([label, name]) => (
              <label
                key={name}
                className="grid gap-1 text-sm font-medium text-slate-700"
              >
                {label}
                <input
                  name={name}
                  required={["name", "email", "teacherNo"].includes(name)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!isDatabaseConfigured}
                />
              </label>
            ))}
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              组织
              <select
                name="organizationId"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              状态
              <select
                name="status"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              >
                <option value="ACTIVE">启用</option>
                <option value="INACTIVE">停用</option>
              </select>
            </label>
            <button
              className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
              disabled={!isDatabaseConfigured || organizations.length === 0}
            >
              创建教师
            </button>
          </div>
        </form>

        <BaseDataImportForm
          action={importTeachersWithState}
          disabled={!isDatabaseConfigured}
          helpText="支持 CSV，字段为姓名、邮箱、工号、职称、组织、状态。组织可填写组织名称或组织 ID；邮箱或工号已存在的记录会自动跳过。"
          templateHref="/admin/base-data/teachers/import-template"
          title="批量导入教师"
        />
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="p-5">
          <input type="hidden" name="page" value="1" />
          <h2 className="text-base font-semibold text-slate-950">筛选教师</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <label className="grid gap-1 text-sm font-medium text-slate-700 xl:col-span-2">
              关键词
              <input
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="姓名 / 邮箱 / 工号"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              组织
              <select
                name="organizationId"
                defaultValue={query.organizationId ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部组织</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              职称
              <select
                name="title"
                defaultValue={query.title ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部职称</option>
                {titles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              状态
              <select
                name="status"
                defaultValue={query.status ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部状态</option>
                <option value="ACTIVE">启用</option>
                <option value="INACTIVE">停用</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              每页
              <select
                name="pageSize"
                defaultValue={String(query.pageSize)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="30">30 条</option>
                <option value="60">60 条</option>
                <option value="100">100 条</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                查询
              </button>
              <Link
                href="/admin/base-data/teachers"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                重置
              </Link>
            </div>
          </div>
        </form>

        <TeacherListTable teachers={teachers} />

        <nav className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            共 {formatInteger(totalCount)} 条，当前第{" "}
            {formatInteger(currentPage)} / {formatInteger(totalPages)} 页，每页{" "}
            {formatInteger(query.pageSize)} 条。
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={currentPage <= 1}
              href={buildTeachersHref(query, {
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
              href={buildTeachersHref(query, {
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
