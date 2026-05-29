import {
  selfEnrollTeachingClass,
  selfUnenrollTeachingClass,
} from "@/app/actions/student-courses";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  canSelfUnenroll,
  filterAvailableTeachingClasses,
  parseStudentCourseQuery,
} from "@/lib/student/self-enrollment";
import Link from "next/link";

type StudentCoursesPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

async function loadStudentCourses(studentId: string) {
  if (!process.env.DATABASE_URL) {
    return {
      allTeachingClasses: [],
      enrollments: [],
      isDatabaseConfigured: false,
      terms: [],
    };
  }

  const { prisma } = await import("@/lib/db");
  const [allTeachingClasses, enrollments] = await Promise.all([
    prisma.teachingClass.findMany({
      include: {
        course: { select: { code: true, name: true } },
        teacher: { select: { name: true } },
        organization: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ term: "desc" }, { name: "asc" }],
    }),
    prisma.enrollment.findMany({
      where: { studentId },
      include: {
        teachingClass: {
          include: {
            course: { select: { code: true, name: true } },
            teacher: { select: { name: true } },
            organization: { select: { name: true } },
            _count: { select: { assignments: true, enrollments: true } },
          },
        },
      },
      orderBy: [{ teachingClass: { term: "desc" } }, { createdAt: "desc" }],
    }),
  ]);

  return {
    allTeachingClasses,
    enrollments,
    isDatabaseConfigured: true,
    terms: Array.from(new Set(allTeachingClasses.map((item) => item.term))).sort(
      (first, second) => second.localeCompare(first, "zh-CN"),
    ),
  };
}

export default async function StudentCoursesPage({
  searchParams,
}: {
  searchParams: StudentCoursesPageSearchParams;
}) {
  const session = await requireRole(["STUDENT"]);
  const query = parseStudentCourseQuery(await searchParams);
  const { allTeachingClasses, enrollments, isDatabaseConfigured, terms } =
    await loadStudentCourses(session.user.id);
  const enrolledTeachingClassIds = new Set(
    enrollments.map((enrollment) => enrollment.teachingClassId),
  );
  const availableTeachingClasses = filterAvailableTeachingClasses(
    allTeachingClasses,
    { enrolledTeachingClassIds, query },
  );
  const lockedEnrollmentCount = enrollments.filter(
    (enrollment) => enrollment.teachingClass._count.assignments > 0,
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">学生评教</StatusBadge>
        <h1 className="mt-3 text-xl font-semibold tracking-normal text-slate-950 sm:text-2xl">
          我的选课
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          自主维护本人教学班选课关系。已产生评教派发的课程不可退选。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载教学班和选课。
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="已选课程" value={enrollments.length} hint="当前学生选课数" />
        <StatCard
          label="可选教学班"
          value={availableTeachingClasses.length}
          hint="当前筛选结果"
        />
        <StatCard
          label="不可退选"
          value={lockedEnrollmentCount}
          hint="已产生评教派发"
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">已选教学班</h2>
            <p className="mt-1 text-sm text-slate-600">
              已派发评教的选课会被锁定，避免影响历史评教和统计。
            </p>
          </div>
          <Link
            href="/student/evaluations"
            className="w-fit rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
          >
            查看我的评教
          </Link>
        </div>

        <div className="space-y-3 md:hidden">
          {enrollments.length ? (
            enrollments.map((enrollment) => {
              const teachingClass = enrollment.teachingClass;
              const assignmentCount = teachingClass._count.assignments;
              const canUnenroll = canSelfUnenroll(assignmentCount);

              return (
                <article
                  key={enrollment.id}
                  className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-950">
                        {teachingClass.course.name}
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {teachingClass.course.code} · {teachingClass.name} ·{" "}
                        {teachingClass.term}
                      </p>
                    </div>
                    {assignmentCount > 0 ? (
                      <StatusBadge tone="warning">已派发</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">未派发</StatusBadge>
                    )}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-slate-50 p-3">
                      <dt className="text-xs font-medium text-slate-500">教师</dt>
                      <dd className="mt-1 text-slate-900">
                        {teachingClass.teacher.name}
                      </dd>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <dt className="text-xs font-medium text-slate-500">同班人数</dt>
                      <dd className="mt-1 text-slate-900">
                        {teachingClass._count.enrollments}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                    {teachingClass.organization?.name ?? "未归属"}
                  </p>
                  <form className="mt-4" action={selfUnenrollTeachingClass}>
                    <input
                      type="hidden"
                      name="teachingClassId"
                      value={teachingClass.id}
                    />
                    <button
                      type="submit"
                      disabled={!canUnenroll}
                      title={canUnenroll ? "退选教学班" : "已有评教派发，不可退选"}
                      className="min-h-11 w-full rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      退选
                    </button>
                  </form>
                </article>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              暂无已选教学班。
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <DataTable
            headers={["课程", "教师", "组织", "同班人数", "评教派发", "操作"]}
            emptyText="暂无已选教学班。"
            rows={enrollments.map((enrollment) => {
              const teachingClass = enrollment.teachingClass;
              const assignmentCount = teachingClass._count.assignments;
              const canUnenroll = canSelfUnenroll(assignmentCount);

              return [
                <div key="course">
                  <div className="font-medium text-slate-950">
                    {teachingClass.course.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {teachingClass.course.code} · {teachingClass.name} ·{" "}
                    {teachingClass.term}
                  </div>
                </div>,
                teachingClass.teacher.name,
                teachingClass.organization?.name ?? "未归属",
                teachingClass._count.enrollments,
                assignmentCount > 0 ? (
                  <StatusBadge key="locked" tone="warning">
                    已派发
                  </StatusBadge>
                ) : (
                  <StatusBadge key="free" tone="neutral">
                    未派发
                  </StatusBadge>
                ),
                <form key="action" action={selfUnenrollTeachingClass}>
                  <input
                    type="hidden"
                    name="teachingClassId"
                    value={teachingClass.id}
                  />
                  <button
                    type="submit"
                    disabled={!canUnenroll}
                    title={canUnenroll ? "退选教学班" : "已有评教派发，不可退选"}
                    className="font-medium text-rose-700 transition hover:text-rose-900 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    退选
                  </button>
                </form>,
              ];
            })}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="border-b border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-950">选择新教学班</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_auto]">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              关键词
              <input
                name="q"
                defaultValue={query.q}
                placeholder="课程 / 代码 / 教师 / 教学班"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              学期
              <select
                name="term"
                defaultValue={query.term}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">全部学期</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                查询
              </button>
              <Link
                href="/student/courses"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                重置
              </Link>
            </div>
          </div>
        </form>

        <DataTable
          headers={["课程", "教师", "组织", "已选人数", "操作"]}
          emptyText="暂无可选教学班。"
          rows={availableTeachingClasses.map((teachingClass) => [
            <div key="course">
              <div className="font-medium text-slate-950">
                {teachingClass.course.name}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {teachingClass.course.code} · {teachingClass.name} ·{" "}
                {teachingClass.term}
              </div>
            </div>,
            teachingClass.teacher.name,
            teachingClass.organization?.name ?? "未归属",
            teachingClass._count.enrollments,
            <form key="action" action={selfEnrollTeachingClass}>
              <input
                type="hidden"
                name="teachingClassId"
                value={teachingClass.id}
              />
              <button
                type="submit"
                className="font-medium text-sky-700 transition hover:text-sky-900"
              >
                选课
              </button>
            </form>,
          ])}
        />
      </section>
    </div>
  );
}
