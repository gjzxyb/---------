import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type OrganizationRow = {
  id: string;
  name: string;
  type: string;
  parent: { name: string } | null;
  _count: { users: number; courses: number; classes: number };
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  organization: { name: string };
  studentProfile: { studentNo: string; grade: string | null; major: string | null } | null;
  teacherProfile: { teacherNo: string; title: string | null } | null;
};

type CourseRow = {
  id: string;
  code: string;
  name: string;
  organization: { name: string } | null;
  _count: { teachingClasses: number };
};

type TeachingClassRow = {
  id: string;
  name: string;
  term: string;
  course: { name: string; code: string };
  teacher: { name: string };
  organization: { name: string } | null;
  _count: { enrollments: number };
};

type BaseData = {
  organizations: OrganizationRow[];
  students: UserRow[];
  teachers: UserRow[];
  courses: CourseRow[];
  teachingClasses: TeachingClassRow[];
  enrollmentCount: number;
  isDatabaseConfigured: boolean;
};

async function loadBaseData(): Promise<BaseData> {
  if (!isDatabaseConfigured()) {
    return {
      organizations: [],
      students: [],
      teachers: [],
      courses: [],
      teachingClasses: [],
      enrollmentCount: 0,
      isDatabaseConfigured: false,
    };
  }

  const { prisma } = await import("@/lib/db");
  const [
    organizations,
    students,
    teachers,
    courses,
    teachingClasses,
    enrollmentCount,
  ] = await Promise.all([
    prisma.organization.findMany({
      include: {
        parent: { select: { name: true } },
        _count: { select: { users: true, courses: true, classes: true } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        organization: { select: { name: true } },
        studentProfile: {
          select: { studentNo: true, grade: true, major: true },
        },
        teacherProfile: true,
      },
      orderBy: { name: "asc" },
      take: 20,
    }),
    prisma.user.findMany({
      where: { role: "TEACHER" },
      include: {
        organization: { select: { name: true } },
        studentProfile: true,
        teacherProfile: { select: { teacherNo: true, title: true } },
      },
      orderBy: { name: "asc" },
      take: 20,
    }),
    prisma.course.findMany({
      include: {
        organization: { select: { name: true } },
        _count: { select: { teachingClasses: true } },
      },
      orderBy: { code: "asc" },
      take: 30,
    }),
    prisma.teachingClass.findMany({
      include: {
        course: { select: { name: true, code: true } },
        teacher: { select: { name: true } },
        organization: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ term: "desc" }, { name: "asc" }],
      take: 30,
    }),
    prisma.enrollment.count(),
  ]);

  return {
    organizations,
    students,
    teachers,
    courses,
    teachingClasses,
    enrollmentCount,
    isDatabaseConfigured: true,
  };
}

function orgTypeLabel(type: string) {
  const labels: Record<string, string> = {
    SCHOOL: "学校",
    DEPARTMENT: "院系",
    CLASS: "行政班",
  };

  return labels[type] ?? type;
}

const baseDataLinks = [
  ["组织结构", "/admin/base-data/organizations", "维护学校、院系、行政班级树"],
  ["课程管理", "/admin/base-data/courses", "维护课程编码、名称和归属组织"],
  ["学生管理", "/admin/base-data/students", "维护学生账号、学号、年级和专业"],
  ["教师管理", "/admin/base-data/teachers", "维护教师账号、工号、职称和组织"],
  ["教学班与选课", "/admin/base-data/classes", "维护授课班级和学生选课关系"],
];

export default async function AdminBaseDataPage() {
  await requireRole([...ADMIN_ROLES]);
  const {
    organizations,
    students,
    teachers,
    courses,
    teachingClasses,
    enrollmentCount,
    isDatabaseConfigured,
  } = await loadBaseData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">基础数据</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          组织、人员与教学数据
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          汇总组织结构、学生、教师、课程、教学班和选课关系，作为评教派发与统计的基础。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("基础数据")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6" aria-label="基础数据概览">
        <StatCard label="组织" value={formatInteger(organizations.length)} hint="学校、院系、班级" />
        <StatCard label="学生" value={formatInteger(students.length)} hint="列表展示前 20 条" />
        <StatCard label="教师" value={formatInteger(teachers.length)} hint="列表展示前 20 条" />
        <StatCard label="课程" value={formatInteger(courses.length)} hint="列表展示前 30 条" />
        <StatCard label="教学班" value={formatInteger(teachingClasses.length)} hint="列表展示前 30 条" />
        <StatCard label="选课关系" value={formatInteger(enrollmentCount)} hint="Enrollment 总数" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {baseDataLinks.map(([title, href, description]) => (
          <Link
            key={href}
            href={href}
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
          >
            <div className="text-base font-semibold text-slate-950">{title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">组织结构</h2>
          <DataTable
            headers={["名称", "类型", "上级", "用户/课程/班级"]}
            emptyText="暂无组织数据。"
            rows={organizations.map((organization) => [
              organization.name,
              orgTypeLabel(organization.type),
              organization.parent?.name ?? "顶级组织",
              `${organization._count.users} / ${organization._count.courses} / ${organization._count.classes}`,
            ])}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">课程</h2>
          <DataTable
            headers={["课程", "归属组织", "教学班数"]}
            emptyText="暂无课程数据。"
            rows={courses.map((course) => [
              <div key="course">
                <div className="font-medium text-slate-900">{course.name}</div>
                <div className="mt-1 text-xs text-slate-500">{course.code}</div>
              </div>,
              course.organization?.name ?? "未归属",
              formatInteger(course._count.teachingClasses),
            ])}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">学生</h2>
          <DataTable
            headers={["学生", "学号", "年级/专业", "状态"]}
            emptyText="暂无学生数据。"
            rows={students.map((student) => [
              <div key="student">
                <div className="font-medium text-slate-900">{student.name}</div>
                <div className="mt-1 text-xs text-slate-500">{student.email}</div>
              </div>,
              student.studentProfile?.studentNo ?? "未建档",
              `${student.studentProfile?.grade ?? "-"} / ${student.studentProfile?.major ?? "-"}`,
              student.status,
            ])}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">教师</h2>
          <DataTable
            headers={["教师", "工号", "职称", "组织"]}
            emptyText="暂无教师数据。"
            rows={teachers.map((teacher) => [
              <div key="teacher">
                <div className="font-medium text-slate-900">{teacher.name}</div>
                <div className="mt-1 text-xs text-slate-500">{teacher.email}</div>
              </div>,
              teacher.teacherProfile?.teacherNo ?? "未建档",
              teacher.teacherProfile?.title ?? "未设置",
              teacher.organization.name,
            ])}
          />
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">教学班与选课</h2>
        <DataTable
          headers={["教学班", "课程", "教师", "组织", "选课人数"]}
          emptyText="暂无教学班数据。"
          rows={teachingClasses.map((teachingClass) => [
            <div key="class">
              <div className="font-medium text-slate-900">{teachingClass.name}</div>
              <div className="mt-1 text-xs text-slate-500">{teachingClass.term}</div>
            </div>,
            `${teachingClass.course.name} (${teachingClass.course.code})`,
            teachingClass.teacher.name,
            teachingClass.organization?.name ?? "未归属",
            formatInteger(teachingClass._count.enrollments),
          ])}
        />
      </div>
    </div>
  );
}
