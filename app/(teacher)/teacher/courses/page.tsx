import Link from "next/link";

import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  courseMatchesStatus,
  getCourseStatusLabel,
  parseTeacherCourseQuery,
  summarizeCourseAssignments,
  type TeacherCourseQuery,
} from "@/lib/teacher/courses";

type TeacherCourse = {
  id: string;
  name: string;
  term: string;
  course: { name: string; code: string };
  organization: { name: string } | null;
  enrollments: {
    student: {
      id: string;
      name: string;
      email: string;
      studentProfile: { grade: string | null; major: string | null; studentNo: string } | null;
    };
  }[];
  assignments: {
    status: string;
    submittedAt: Date | null;
    task: { name: string; status: string; startsAt: Date | null; endsAt: Date | null };
  }[];
  improvementPlans: { id: string; status: string }[];
};

type TeacherCoursesData = {
  classes: TeacherCourse[];
  isDatabaseConfigured: boolean;
  terms: string[];
};

type TeacherCoursesPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

async function loadTeacherCourses(
  teacherId: string,
): Promise<TeacherCoursesData> {
  if (!process.env.DATABASE_URL) {
    return { classes: [], isDatabaseConfigured: false, terms: [] };
  }

  const { prisma } = await import("@/lib/db");
  const classes = await prisma.teachingClass.findMany({
    where: { teacherId },
    include: {
      course: true,
      organization: { select: { name: true } },
      enrollments: {
        include: {
          student: {
            select: {
              email: true,
              id: true,
              name: true,
              studentProfile: {
                select: { grade: true, major: true, studentNo: true },
              },
            },
          },
        },
        orderBy: [{ student: { name: "asc" } }],
      },
      assignments: {
        include: { task: true },
        orderBy: [{ assignedAt: "desc" }],
      },
      improvementPlans: {
        select: { id: true, status: true },
      },
    },
    orderBy: [{ term: "desc" }, { name: "asc" }],
  });

  return {
    classes,
    isDatabaseConfigured: true,
    terms: Array.from(new Set(classes.map((teachingClass) => teachingClass.term))),
  };
}

function formatDate(date: Date | null) {
  if (!date) {
    return "未设置";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function statusTone(status: string) {
  if (status === "已完成") {
    return "success" as const;
  }

  if (status === "收集中") {
    return "info" as const;
  }

  if (status === "暂无任务") {
    return "neutral" as const;
  }

  return "warning" as const;
}

function filterClasses(classes: TeacherCourse[], query: TeacherCourseQuery) {
  return classes.filter((teachingClass) => {
    const keyword = query.q.toLowerCase();
    const matchesKeyword =
      !keyword ||
      teachingClass.name.toLowerCase().includes(keyword) ||
      teachingClass.course.name.toLowerCase().includes(keyword) ||
      teachingClass.course.code.toLowerCase().includes(keyword);
    const matchesTerm = !query.term || teachingClass.term === query.term;
    const matchesStatus = courseMatchesStatus(teachingClass.assignments, query.status);

    return matchesKeyword && matchesTerm && matchesStatus;
  });
}

export default async function TeacherCoursesPage({
  searchParams,
}: {
  searchParams: TeacherCoursesPageSearchParams;
}) {
  const session = await requireRole(["TEACHER"]);
  const query = parseTeacherCourseQuery(await searchParams);
  const { classes, isDatabaseConfigured, terms } = await loadTeacherCourses(
    session.user.id,
  );
  const filteredClasses = filterClasses(classes, query);
  const enrollmentCount = filteredClasses.reduce(
    (total, teachingClass) => total + teachingClass.enrollments.length,
    0,
  );
  const assignmentCount = filteredClasses.reduce(
    (total, teachingClass) => total + teachingClass.assignments.length,
    0,
  );
  const submittedCount = filteredClasses.reduce(
    (total, teachingClass) =>
      total + summarizeCourseAssignments(teachingClass.assignments).submitted,
    0,
  );
  const openTaskClassCount = filteredClasses.filter(
    (teachingClass) =>
      summarizeCourseAssignments(teachingClass.assignments).openTasks > 0,
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">教师发展</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          授课班级
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          查看本人任课班级、选课学生名单、评教回收进度和后续处理入口。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载授课班级。
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="授课概览">
        <StatCard label="筛选班级" value={filteredClasses.length} hint="符合当前条件" />
        <StatCard label="选课学生" value={enrollmentCount} hint="当前筛选范围" />
        <StatCard label="评教派发" value={assignmentCount} hint={`${submittedCount} 份已提交`} />
        <StatCard label="收集中班级" value={openTaskClassCount} hint="存在开放评教任务" />
      </section>

      <form className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">筛选授课班级</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            课程 / 班级 / 课程代码
            <input
              name="q"
              defaultValue={query.q}
              placeholder="输入关键词"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            学期
            <select
              name="term"
              defaultValue={query.term}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">全部学期</option>
              {terms.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            任务状态
            <select
              name="status"
              defaultValue={query.status}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">全部状态</option>
              <option value="OPEN_TASK">收集中</option>
              <option value="COMPLETED">已完成</option>
              <option value="NO_TASK">暂无任务</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              查询
            </button>
            <Link
              href="/teacher/courses"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              重置
            </Link>
          </div>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">授课班级列表</h2>
            <p className="mt-1 text-sm text-slate-600">
              展开班级可查看选课学生名单；评教内容仍在评价结果页按匿名规则呈现。
            </p>
          </div>
          <Link
            href="/teacher/results"
            className="w-fit rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
          >
            查看全部评价结果
          </Link>
        </div>

        <DataTable
          headers={["课程班", "组织", "学生", "评教进度", "最近截止", "改进计划", "操作"]}
          emptyText="暂无授课班级。"
        >
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredClasses.length ? (
              filteredClasses.map((teachingClass) => {
                const summary = summarizeCourseAssignments(teachingClass.assignments);
                const statusLabel = getCourseStatusLabel(teachingClass.assignments);
                const activePlans = teachingClass.improvementPlans.filter((plan) =>
                  ["OPEN", "IN_PROGRESS"].includes(plan.status),
                ).length;

                return (
                  <tr key={teachingClass.id} className="align-top">
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-950">
                        {teachingClass.course.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {teachingClass.course.code} · {teachingClass.name} ·{" "}
                        {teachingClass.term}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {teachingClass.organization?.name ?? "未设置"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <details>
                        <summary className="cursor-pointer font-medium text-sky-700">
                          {teachingClass.enrollments.length} 人
                        </summary>
                        <div className="mt-3 max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-50">
                          {teachingClass.enrollments.length ? (
                            <ul className="divide-y divide-slate-200">
                              {teachingClass.enrollments.map(({ student }) => (
                                <li key={student.id} className="px-3 py-2">
                                  <div className="font-medium text-slate-900">
                                    {student.name}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {student.studentProfile?.studentNo ?? "无学号"} ·{" "}
                                    {student.studentProfile?.grade ?? "未设年级"} ·{" "}
                                    {student.studentProfile?.major ?? "未设专业"}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="px-3 py-4 text-xs text-slate-500">
                              暂无选课学生。
                            </p>
                          )}
                        </div>
                      </details>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <StatusBadge tone={statusTone(statusLabel)}>
                        {statusLabel}
                      </StatusBadge>
                      <div className="mt-2 text-xs text-slate-500">
                        {summary.submitted}/{summary.total} 已提交 ·{" "}
                        {summary.responseRate}% 回收
                      </div>
                      {summary.pending > 0 ? (
                        <div className="mt-1 text-xs text-amber-700">
                          {summary.pending} 份待提交
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatDate(summary.nextDeadline)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div>{teachingClass.improvementPlans.length} 条</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {activePlans} 条推进中
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/teacher/results/${teachingClass.id}`}
                          className="font-medium text-sky-700 transition hover:text-sky-900"
                        >
                          评价详情
                        </Link>
                        <Link
                          href={`/teacher/improvements?teachingClassId=${teachingClass.id}`}
                          className="font-medium text-slate-700 transition hover:text-slate-950"
                        >
                          改进计划
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  暂无授课班级。
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </section>
    </div>
  );
}
