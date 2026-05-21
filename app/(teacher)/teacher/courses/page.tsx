import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";

type TeacherCourse = {
  id: string;
  name: string;
  term: string;
  course: { name: string; code: string };
  assignments: {
    status: string;
    task: { status: string };
  }[];
  _count: { enrollments: number };
};

type TeacherCoursesData = {
  classes: TeacherCourse[];
  isDatabaseConfigured: boolean;
};

async function loadTeacherCourses(
  teacherId: string,
): Promise<TeacherCoursesData> {
  if (!process.env.DATABASE_URL) {
    return { classes: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const classes = await prisma.teachingClass.findMany({
    where: { teacherId },
    include: {
      course: true,
      assignments: {
        include: { task: true },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: [{ term: "desc" }, { name: "asc" }],
  });

  return { classes, isDatabaseConfigured: true };
}

function summarizeAssignments(assignments: TeacherCourse["assignments"]) {
  if (assignments.length === 0) {
    return "暂无评教任务";
  }

  const submitted = assignments.filter(
    (assignment) => assignment.status === "SUBMITTED",
  ).length;
  const openTasks = assignments.filter(
    (assignment) => assignment.task.status === "OPEN",
  ).length;

  return `${submitted}/${assignments.length} 已提交，${openTasks} 个开放任务`;
}

export default async function TeacherCoursesPage() {
  const session = await requireRole(["TEACHER"]);
  const { classes, isDatabaseConfigured } = await loadTeacherCourses(
    session.user.id,
  );
  const enrollmentCount = classes.reduce(
    (total, teachingClass) => total + teachingClass._count.enrollments,
    0,
  );
  const assignmentCount = classes.reduce(
    (total, teachingClass) => total + teachingClass.assignments.length,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <StatusBadge tone="info">教师发展</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          授课班级
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          查看本人名下课程班、学生规模和评教任务进展。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载授课班级。
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="授课概览">
        <StatCard label="授课班级" value={classes.length} hint="当前教师名下班级" />
        <StatCard label="学生人数" value={enrollmentCount} hint="已选课学生总数" />
        <StatCard label="评教任务" value={assignmentCount} hint="关联评价派发数" />
      </section>

      <DataTable
        headers={["学期", "课程", "班级", "人数", "任务状态"]}
        emptyText="暂无授课班级。"
        rows={classes.map((teachingClass) => [
          teachingClass.term,
          <div key="course">
            <div className="font-medium text-slate-900">
              {teachingClass.course.name}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {teachingClass.course.code}
            </div>
          </div>,
          teachingClass.name,
          teachingClass._count.enrollments,
          summarizeAssignments(teachingClass.assignments),
        ])}
      />
    </div>
  );
}
