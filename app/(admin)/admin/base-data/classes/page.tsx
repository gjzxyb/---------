import Link from "next/link";

import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  createEnrollment,
  createTeachingClass,
  deleteEnrollment,
  deleteTeachingClass,
  importEnrollments,
  importTeachingClasses,
} from "@/app/actions/base-data";
import { requireRole } from "@/lib/auth/guards";
import {
  parseClassListQuery,
  parseEnrollmentListQuery,
} from "@/lib/base-data/class-enrollment";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type ClassesPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.flatMap((value) => (value ? [value] : []))),
  ).sort((first, second) => first.localeCompare(second, "zh-CN"));
}

function buildHref(
  classQuery: ReturnType<typeof parseClassListQuery>,
  enrollmentQuery: ReturnType<typeof parseEnrollmentListQuery>,
  updates: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  const merged = { ...classQuery, ...enrollmentQuery, ...updates };

  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();

  return queryString
    ? `/admin/base-data/classes?${queryString}`
    : "/admin/base-data/classes";
}

async function loadData(
  classQuery: ReturnType<typeof parseClassListQuery>,
  enrollmentQuery: ReturnType<typeof parseEnrollmentListQuery>,
) {
  if (!isDatabaseConfigured()) {
    return {
      classesTotalCount: 0,
      courses: [],
      enrollmentTotalCount: 0,
      enrollments: [],
      isDatabaseConfigured: false,
      organizations: [],
      students: [],
      teachingClasses: [],
      teachers: [],
      terms: [],
      totalClassesPages: 1,
      totalEnrollmentPages: 1,
    };
  }

  const { prisma } = await import("@/lib/db");
  const classFilters = [];
  const enrollmentFilters = [];

  if (classQuery.q) {
    classFilters.push({
      OR: [
        { name: { contains: classQuery.q } },
        { course: { is: { name: { contains: classQuery.q } } } },
        { course: { is: { code: { contains: classQuery.q } } } },
        { teacher: { is: { name: { contains: classQuery.q } } } },
      ],
    });
  }

  if (classQuery.term) {
    classFilters.push({ term: classQuery.term });
  }

  if (classQuery.courseId) {
    classFilters.push({ courseId: classQuery.courseId });
  }

  if (classQuery.teacherId) {
    classFilters.push({ teacherId: classQuery.teacherId });
  }

  if (classQuery.organizationId) {
    classFilters.push({ organizationId: classQuery.organizationId });
  }

  if (enrollmentQuery.enrollmentQ) {
    enrollmentFilters.push({
      OR: [
        { student: { is: { name: { contains: enrollmentQuery.enrollmentQ } } } },
        { student: { is: { email: { contains: enrollmentQuery.enrollmentQ } } } },
        {
          student: {
            is: {
              studentProfile: {
                is: { studentNo: { contains: enrollmentQuery.enrollmentQ } },
              },
            },
          },
        },
        {
          teachingClass: {
            is: { name: { contains: enrollmentQuery.enrollmentQ } },
          },
        },
      ],
    });
  }

  if (enrollmentQuery.enrollmentTerm) {
    enrollmentFilters.push({
      teachingClass: { is: { term: enrollmentQuery.enrollmentTerm } },
    });
  }

  if (enrollmentQuery.enrollmentTeachingClassId) {
    enrollmentFilters.push({
      teachingClassId: enrollmentQuery.enrollmentTeachingClassId,
    });
  }

  const classWhere = classFilters.length > 0 ? { AND: classFilters } : {};
  const enrollmentWhere =
    enrollmentFilters.length > 0 ? { AND: enrollmentFilters } : {};
  const classSkip =
    (classQuery.classPage - 1) * classQuery.classPageSize;
  const enrollmentSkip =
    (enrollmentQuery.enrollmentPage - 1) *
    enrollmentQuery.enrollmentPageSize;

  const [
    teachingClasses,
    classesTotalCount,
    allTeachingClasses,
    courses,
    teachers,
    organizations,
    students,
    enrollments,
    enrollmentTotalCount,
  ] = await Promise.all([
    prisma.teachingClass.findMany({
      include: {
        course: { select: { code: true, name: true } },
        organization: { select: { name: true } },
        teacher: { select: { name: true } },
        _count: { select: { assignments: true, enrollments: true } },
      },
      orderBy: [{ term: "desc" }, { name: "asc" }],
      skip: classSkip,
      take: classQuery.classPageSize,
      where: classWhere,
    }),
    prisma.teachingClass.count({ where: classWhere }),
    prisma.teachingClass.findMany({
      include: {
        course: { select: { code: true, name: true } },
      },
      orderBy: [{ term: "desc" }, { name: "asc" }],
    }),
    prisma.course.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      where: { role: "TEACHER" },
    }),
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      include: { studentProfile: true },
      orderBy: { name: "asc" },
      where: { role: "STUDENT" },
    }),
    prisma.enrollment.findMany({
      include: {
        student: {
          select: {
            email: true,
            name: true,
            studentProfile: { select: { studentNo: true } },
          },
        },
        teachingClass: {
          select: {
            id: true,
            name: true,
            term: true,
            assignments: { select: { evaluatorId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: enrollmentSkip,
      take: enrollmentQuery.enrollmentPageSize,
      where: enrollmentWhere,
    }),
    prisma.enrollment.count({ where: enrollmentWhere }),
  ]);

  return {
    classesTotalCount,
    courses,
    enrollmentTotalCount,
    enrollments,
    isDatabaseConfigured: true,
    organizations,
    students,
    teachingClasses,
    teachers,
    terms: uniqueValues(allTeachingClasses.map((item) => item.term)),
    totalClassesPages: Math.max(
      1,
      Math.ceil(classesTotalCount / classQuery.classPageSize),
    ),
    totalEnrollmentPages: Math.max(
      1,
      Math.ceil(enrollmentTotalCount / enrollmentQuery.enrollmentPageSize),
    ),
  };
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: ClassesPageSearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);
  const rawSearchParams = await searchParams;
  const classQuery = parseClassListQuery(rawSearchParams);
  const enrollmentQuery = parseEnrollmentListQuery(rawSearchParams);
  const {
    classesTotalCount,
    courses,
    enrollmentTotalCount,
    enrollments,
    isDatabaseConfigured,
    organizations,
    students,
    teachingClasses,
    teachers,
    terms,
    totalClassesPages,
    totalEnrollmentPages,
  } = await loadData(classQuery, enrollmentQuery);
  const currentClassPage = Math.min(
    classQuery.classPage,
    totalClassesPages,
  );
  const currentEnrollmentPage = Math.min(
    enrollmentQuery.enrollmentPage,
    totalEnrollmentPages,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">基础数据</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          教学班与选课
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          管理教学班、授课教师、教学班学生名单和选课导入。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("教学班与选课")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="教学班"
          value={formatInteger(classesTotalCount)}
          hint="符合当前筛选条件"
        />
        <StatCard
          label="选课关系"
          value={formatInteger(enrollmentTotalCount)}
          hint="符合当前筛选条件"
        />
        <StatCard
          label="可选学生"
          value={formatInteger(students.length)}
          hint="学生账号"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form
          action={createTeachingClass}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-950">新建教学班</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              名称
              <input
                name="name"
                required
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
              课程
              <select
                name="courseId"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              教师
              <select
                name="teacherId"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              >
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              组织
              <select
                name="organizationId"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              >
                <option value="">未归属</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
              disabled={
                !isDatabaseConfigured ||
                courses.length === 0 ||
                teachers.length === 0
              }
            >
              创建教学班
            </button>
          </div>
        </form>

        <form
          action={importTeachingClasses}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                批量导入教学班
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                支持 CSV，字段为教学班、学期、课程代码、教师工号、组织。
              </p>
            </div>
            <Link
              href="/admin/base-data/classes/class-import-template"
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
            课程按课程代码匹配，教师按工号匹配，组织可填写组织名称或组织 ID；重复教学班会自动跳过。
          </p>
          <button
            className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            disabled={!isDatabaseConfigured}
          >
            导入教学班
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="p-5">
          <input type="hidden" name="classPage" value="1" />
          <input
            type="hidden"
            name="enrollmentPage"
            value={enrollmentQuery.enrollmentPage}
          />
          <h2 className="text-base font-semibold text-slate-950">筛选教学班</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              关键词
              <input
                name="q"
                defaultValue={classQuery.q ?? ""}
                placeholder="班级 / 课程 / 教师"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              学期
              <select
                name="term"
                defaultValue={classQuery.term ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部学期</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              课程
              <select
                name="courseId"
                defaultValue={classQuery.courseId ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部课程</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              教师
              <select
                name="teacherId"
                defaultValue={classQuery.teacherId ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部教师</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              每页
              <select
                name="classPageSize"
                defaultValue={String(classQuery.classPageSize)}
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
                href="/admin/base-data/classes"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                重置
              </Link>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["教学班", "课程", "教师", "组织", "选课/派发", "操作"].map(
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
              {teachingClasses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    暂无教学班。
                  </td>
                </tr>
              ) : null}
              {teachingClasses.map((teachingClass) => {
                const canDelete = teachingClass._count.assignments === 0;

                return (
                  <tr key={teachingClass.id}>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">
                        {teachingClass.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {teachingClass.term}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {teachingClass.course.name} ({teachingClass.course.code})
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {teachingClass.teacher.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {teachingClass.organization?.name ?? "未归属"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {teachingClass._count.enrollments} /{" "}
                      {teachingClass._count.assignments}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <form action={deleteTeachingClass}>
                        <input type="hidden" name="id" value={teachingClass.id} />
                        <button
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? "删除教学班"
                              : "已有评教派发，不可删除"
                          }
                          className="text-sm font-medium text-rose-700 disabled:text-slate-400"
                        >
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
            共 {formatInteger(classesTotalCount)} 条，当前第{" "}
            {formatInteger(currentClassPage)} /{" "}
            {formatInteger(totalClassesPages)} 页。
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={currentClassPage <= 1}
              href={buildHref(classQuery, enrollmentQuery, {
                classPage: Math.max(1, currentClassPage - 1),
              })}
              className={`rounded-md border px-3 py-2 font-medium ${
                currentClassPage <= 1
                  ? "pointer-events-none border-slate-200 text-slate-300"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              上一页
            </Link>
            <Link
              aria-disabled={currentClassPage >= totalClassesPages}
              href={buildHref(classQuery, enrollmentQuery, {
                classPage: Math.min(totalClassesPages, currentClassPage + 1),
              })}
              className={`rounded-md border px-3 py-2 font-medium ${
                currentClassPage >= totalClassesPages
                  ? "pointer-events-none border-slate-200 text-slate-300"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              下一页
            </Link>
          </div>
        </nav>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form
          action={createEnrollment}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-950">添加选课</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              教学班
              <select
                name="teachingClassId"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              >
                {teachingClasses.map((teachingClass) => (
                  <option key={teachingClass.id} value={teachingClass.id}>
                    {teachingClass.term} · {teachingClass.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              学生
              <select
                name="studentId"
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ·{" "}
                    {student.studentProfile?.studentNo ?? "未建档"}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
              disabled={
                !isDatabaseConfigured ||
                teachingClasses.length === 0 ||
                students.length === 0
              }
            >
              添加选课
            </button>
          </div>
        </form>

        <form
          action={importEnrollments}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                批量导入选课
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                支持 CSV，字段为学期、教学班、学号。
              </p>
            </div>
            <Link
              href="/admin/base-data/classes/import-template"
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
            系统会按“学期 + 教学班名称”匹配教学班，按学号匹配学生；重复选课会自动跳过。
          </p>
          <button
            className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            disabled={!isDatabaseConfigured}
          >
            导入选课
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="p-5">
          <input type="hidden" name="enrollmentPage" value="1" />
          <input type="hidden" name="classPage" value={classQuery.classPage} />
          <h2 className="text-base font-semibold text-slate-950">筛选选课</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              关键词
              <input
                name="enrollmentQ"
                defaultValue={enrollmentQuery.enrollmentQ ?? ""}
                placeholder="学生 / 邮箱 / 学号 / 教学班"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              学期
              <select
                name="enrollmentTerm"
                defaultValue={enrollmentQuery.enrollmentTerm ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部学期</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              教学班
              <select
                name="enrollmentTeachingClassId"
                defaultValue={
                  enrollmentQuery.enrollmentTeachingClassId ?? ""
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部教学班</option>
                {teachingClasses.map((teachingClass) => (
                  <option key={teachingClass.id} value={teachingClass.id}>
                    {teachingClass.term} · {teachingClass.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              每页
              <select
                name="enrollmentPageSize"
                defaultValue={String(enrollmentQuery.enrollmentPageSize)}
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
                href="/admin/base-data/classes"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                重置
              </Link>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["教学班", "学生", "学号", "评教派发", "操作"].map((header) => (
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
              {enrollments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    暂无选课记录。
                  </td>
                </tr>
              ) : null}
              {enrollments.map((enrollment) => {
                const hasAssignment =
                  enrollment.teachingClass.assignments.some(
                    (assignment) =>
                      assignment.evaluatorId === enrollment.studentId,
                  );

                return (
                  <tr key={enrollment.id}>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">
                        {enrollment.teachingClass.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {enrollment.teachingClass.term}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">
                        {enrollment.student.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {enrollment.student.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {enrollment.student.studentProfile?.studentNo ?? "未建档"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {hasAssignment ? "已派发" : "未派发"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <form action={deleteEnrollment}>
                        <input type="hidden" name="id" value={enrollment.id} />
                        <button
                          disabled={hasAssignment}
                          title={
                            hasAssignment
                              ? "已有评教派发，不可移除"
                              : "移除选课"
                          }
                          className="text-sm font-medium text-rose-700 disabled:text-slate-400"
                        >
                          移除
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
            共 {formatInteger(enrollmentTotalCount)} 条，当前第{" "}
            {formatInteger(currentEnrollmentPage)} /{" "}
            {formatInteger(totalEnrollmentPages)} 页。
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={currentEnrollmentPage <= 1}
              href={buildHref(classQuery, enrollmentQuery, {
                enrollmentPage: Math.max(1, currentEnrollmentPage - 1),
              })}
              className={`rounded-md border px-3 py-2 font-medium ${
                currentEnrollmentPage <= 1
                  ? "pointer-events-none border-slate-200 text-slate-300"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              上一页
            </Link>
            <Link
              aria-disabled={currentEnrollmentPage >= totalEnrollmentPages}
              href={buildHref(classQuery, enrollmentQuery, {
                enrollmentPage: Math.min(
                  totalEnrollmentPages,
                  currentEnrollmentPage + 1,
                ),
              })}
              className={`rounded-md border px-3 py-2 font-medium ${
                currentEnrollmentPage >= totalEnrollmentPages
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
