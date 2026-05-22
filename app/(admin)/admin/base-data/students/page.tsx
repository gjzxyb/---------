import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  createStudent,
  deleteStudent,
  deleteStudents,
  importStudents,
} from "@/app/actions/base-data";
import { requireRole } from "@/lib/auth/guards";
import { parseStudentListQuery } from "@/lib/base-data/student-import";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type StudentsPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function uniqueValues(values: Array<string | null>) {
  return Array.from(
    new Set(values.flatMap((value) => (value ? [value] : []))),
  ).sort((first, second) => first.localeCompare(second, "zh-CN"));
}

function buildStudentsHref(
  query: ReturnType<typeof parseStudentListQuery>,
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
    ? `/admin/base-data/students?${queryString}`
    : "/admin/base-data/students";
}

async function loadData(query: ReturnType<typeof parseStudentListQuery>) {
  if (!isDatabaseConfigured()) {
    return {
      activeCount: 0,
      grades: [],
      isDatabaseConfigured: false,
      majors: [],
      organizations: [],
      students: [],
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
        { studentProfile: { is: { studentNo: { contains: query.q } } } },
      ],
    });
  }

  if (query.organizationId) {
    andFilters.push({ organizationId: query.organizationId });
  }

  if (query.status) {
    andFilters.push({ status: query.status });
  }

  if (query.grade) {
    andFilters.push({ studentProfile: { is: { grade: query.grade } } });
  }

  if (query.major) {
    andFilters.push({ studentProfile: { is: { major: query.major } } });
  }

  const where = {
    role: "STUDENT" as const,
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;

  const [
    students,
    organizations,
    totalCount,
    activeCount,
    studentProfiles,
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        organization: { select: { name: true } },
        studentProfile: true,
        _count: { select: { enrollments: true, assignments: true } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      skip,
      take: query.pageSize,
      where,
    }),
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.studentProfile.findMany({
      select: { grade: true, major: true },
      orderBy: [{ grade: "asc" }, { major: "asc" }],
    }),
  ]);

  return {
    activeCount,
    grades: uniqueValues(studentProfiles.map((profile) => profile.grade)),
    isDatabaseConfigured: true,
    majors: uniqueValues(studentProfiles.map((profile) => profile.major)),
    organizations,
    students,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
  };
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: StudentsPageSearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);
  const query = parseStudentListQuery(await searchParams);
  const {
    activeCount,
    grades,
    isDatabaseConfigured,
    majors,
    organizations,
    students,
    totalCount,
    totalPages,
  } = await loadData(query);
  const currentPage = Math.min(query.page, totalPages);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">基础数据</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          学生管理
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          新建和导入账号默认密码为 Password123!。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("学生")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="筛选结果" value={formatInteger(totalCount)} hint="符合当前条件的学生" />
        <StatCard label="启用账号" value={formatInteger(activeCount)} hint="当前条件下可登录" />
        <StatCard label="本页选课记录" value={formatInteger(students.reduce((sum, item) => sum + item._count.enrollments, 0))} hint="当前页学生选课数" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form action={createStudent} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">新建学生</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              ["姓名", "name"],
              ["邮箱", "email"],
              ["学号", "studentNo"],
              ["年级", "grade"],
              ["专业", "major"],
            ].map(([label, name]) => (
              <label key={name} className="grid gap-1 text-sm font-medium text-slate-700">
                {label}
                <input name={name} required={["name", "email", "studentNo"].includes(name)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured} />
              </label>
            ))}
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              组织
              <select name="organizationId" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured}>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              状态
              <select name="status" className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured}>
                <option value="ACTIVE">启用</option>
                <option value="INACTIVE">停用</option>
              </select>
            </label>
            <button className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!isDatabaseConfigured || organizations.length === 0}>
              创建学生
            </button>
          </div>
        </form>

        <form action={importStudents} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">批量导入学生</h2>
              <p className="mt-1 text-sm text-slate-600">
                支持 CSV，字段为姓名、邮箱、学号、年级、专业、组织、状态。
              </p>
            </div>
            <Link
              href="/admin/base-data/students/import-template"
              className="text-sm font-medium text-sky-700"
            >
              下载 CSV 模板
            </Link>
          </div>
          <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
            导入文件
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={!isDatabaseConfigured}
            />
          </label>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            组织可填写组织名称或组织 ID；邮箱或学号已存在的记录会自动跳过。
          </p>
          <button
            className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            disabled={!isDatabaseConfigured}
          >
            导入学生
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="p-5">
          <input type="hidden" name="page" value="1" />
          <h2 className="text-base font-semibold text-slate-950">筛选学生</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <label className="grid gap-1 text-sm font-medium text-slate-700 xl:col-span-2">
              关键词
              <input name="q" defaultValue={query.q ?? ""} placeholder="姓名 / 邮箱 / 学号" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              组织
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
              状态
              <select name="status" defaultValue={query.status ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部状态</option>
                <option value="ACTIVE">启用</option>
                <option value="INACTIVE">停用</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              年级
              <select name="grade" defaultValue={query.grade ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部年级</option>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              专业
              <select name="major" defaultValue={query.major ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部专业</option>
                {majors.map((major) => (
                  <option key={major} value={major}>{major}</option>
                ))}
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
              <Link href="/admin/base-data/students" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                重置
              </Link>
            </div>
          </div>
        </form>

        <form id="delete-students-form" action={deleteStudents} />

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">学生列表</h2>
            <p className="mt-1 text-sm text-slate-500">
              勾选无选课、无评教派发的学生后可批量删除；有关联数据的学生会被锁定。
            </p>
          </div>
          <button
            form="delete-students-form"
            className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            批量删除选中
          </button>
        </div>

        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["选择", "学生", "学号", "年级/专业", "组织", "状态", "选课/评教", "操作"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    暂无学生数据。
                  </td>
                </tr>
              ) : null}
              {students.map((student) => {
                const canDelete =
                  student._count.enrollments === 0 && student._count.assignments === 0;

                return (
                  <tr key={student.id}>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <input
                        form="delete-students-form"
                        type="checkbox"
                        name="ids"
                        value={student.id}
                        disabled={!canDelete}
                        aria-label={`选择删除 ${student.name}`}
                        title={canDelete ? "选择批量删除" : "已有选课或评教派发，不可批量删除"}
                        className="h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{student.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{student.email}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {student.studentProfile?.studentNo ?? "未建档"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {student.studentProfile?.grade ?? "-"} / {student.studentProfile?.major ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {student.organization.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {student.status === "ACTIVE" ? "启用" : "停用"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {student._count.enrollments} / {student._count.assignments}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <form action={deleteStudent}>
                        <input type="hidden" name="id" value={student.id} />
                        <button disabled={!canDelete} title={canDelete ? "删除学生" : "已有选课或评教派发，不可删除"} className="text-sm font-medium text-rose-700 disabled:text-slate-400">
                          删除
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <nav className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            共 {formatInteger(totalCount)} 条，当前第 {formatInteger(currentPage)} / {formatInteger(totalPages)} 页，每页 {formatInteger(query.pageSize)} 条。
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={currentPage <= 1}
              href={buildStudentsHref(query, { page: Math.max(1, currentPage - 1) })}
              className={`rounded-md border px-3 py-2 font-medium ${currentPage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700"}`}
            >
              上一页
            </Link>
            <Link
              aria-disabled={currentPage >= totalPages}
              href={buildStudentsHref(query, { page: Math.min(totalPages, currentPage + 1) })}
              className={`rounded-md border px-3 py-2 font-medium ${currentPage >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700"}`}
            >
              下一页
            </Link>
          </div>
        </nav>
      </section>
    </div>
  );
}
