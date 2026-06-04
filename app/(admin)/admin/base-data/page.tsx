import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { flattenOrganizationTree } from "@/lib/base-data/organization-tree";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type OrganizationRow = {
  id: string;
  name: string;
  parentId: string | null;
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

const BASE_DATA_PAGE_SIZE = 10;

type BaseDataPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type BaseDataPageKey =
  | "classPage"
  | "coursePage"
  | "organizationPage"
  | "studentPage"
  | "teacherPage";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageNumber(
  searchParams: Record<string, string | string[] | undefined>,
  key: BaseDataPageKey,
) {
  const page = Number(firstSearchValue(searchParams[key]));

  return Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
}

function paginateItems<T>(
  items: T[],
  searchParams: Record<string, string | string[] | undefined>,
  key: BaseDataPageKey,
) {
  const totalPages = Math.max(Math.ceil(items.length / BASE_DATA_PAGE_SIZE), 1);
  const currentPage = Math.min(parsePageNumber(searchParams, key), totalPages);
  const start = (currentPage - 1) * BASE_DATA_PAGE_SIZE;

  return {
    currentPage,
    items: items.slice(start, start + BASE_DATA_PAGE_SIZE),
    pageSize: BASE_DATA_PAGE_SIZE,
    totalItems: items.length,
    totalPages,
  };
}

function buildPageHref(
  searchParams: Record<string, string | string[] | undefined>,
  key: BaseDataPageKey,
  page: number,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([paramKey, value]) => {
    if (paramKey === key) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) {
          params.append(paramKey, item);
        }
      });
      return;
    }

    if (value) {
      params.set(paramKey, value);
    }
  });

  if (page > 1) {
    params.set(key, String(page));
  }

  const queryString = params.toString();

  return queryString ? `/admin/base-data?${queryString}` : "/admin/base-data";
}

function PaginationControls({
  label,
  page,
  pageKey,
  searchParams,
}: {
  label: string;
  page: ReturnType<typeof paginateItems>;
  pageKey: BaseDataPageKey;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (page.totalItems <= page.pageSize) {
    return null;
  }

  const start = (page.currentPage - 1) * page.pageSize + 1;
  const end = Math.min(page.currentPage * page.pageSize, page.totalItems);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {label}：{formatInteger(start)}-{formatInteger(end)} /{" "}
        {formatInteger(page.totalItems)}
      </span>
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={page.currentPage <= 1}
          className={`rounded-md border border-slate-300 px-3 py-1.5 font-medium ${
            page.currentPage <= 1
              ? "pointer-events-none text-slate-300"
              : "text-slate-700 hover:bg-slate-50"
          }`}
          href={buildPageHref(
            searchParams,
            pageKey,
            Math.max(1, page.currentPage - 1),
          )}
        >
          上一页
        </Link>
        <span className="min-w-16 text-center text-xs text-slate-500">
          {formatInteger(page.currentPage)} / {formatInteger(page.totalPages)}
        </span>
        <Link
          aria-disabled={page.currentPage >= page.totalPages}
          className={`rounded-md border border-slate-300 px-3 py-1.5 font-medium ${
            page.currentPage >= page.totalPages
              ? "pointer-events-none text-slate-300"
              : "text-slate-700 hover:bg-slate-50"
          }`}
          href={buildPageHref(
            searchParams,
            pageKey,
            Math.min(page.totalPages, page.currentPage + 1),
          )}
        >
          下一页
        </Link>
      </div>
    </div>
  );
}

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
    }),
    prisma.user.findMany({
      where: { role: "TEACHER" },
      include: {
        organization: { select: { name: true } },
        studentProfile: true,
        teacherProfile: { select: { teacherNo: true, title: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.course.findMany({
      include: {
        organization: { select: { name: true } },
        _count: { select: { teachingClasses: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.teachingClass.findMany({
      include: {
        course: { select: { name: true, code: true } },
        teacher: { select: { name: true } },
        organization: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ term: "desc" }, { name: "asc" }],
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

export default async function AdminBaseDataPage({
  searchParams,
}: {
  searchParams: BaseDataPageSearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);
  const rawSearchParams = await searchParams;
  const {
    organizations,
    students,
    teachers,
    courses,
    teachingClasses,
    enrollmentCount,
    isDatabaseConfigured,
  } = await loadBaseData();
  const organizationTreeRows = flattenOrganizationTree(organizations);
  const organizationPage = paginateItems(
    organizationTreeRows,
    rawSearchParams,
    "organizationPage",
  );
  const coursePage = paginateItems(courses, rawSearchParams, "coursePage");
  const studentPage = paginateItems(students, rawSearchParams, "studentPage");
  const teacherPage = paginateItems(teachers, rawSearchParams, "teacherPage");
  const classPage = paginateItems(
    teachingClasses,
    rawSearchParams,
    "classPage",
  );

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
        <StatCard label="学生" value={formatInteger(students.length)} hint="学生账号总数" />
        <StatCard label="教师" value={formatInteger(teachers.length)} hint="教师账号总数" />
        <StatCard label="课程" value={formatInteger(courses.length)} hint="课程总数" />
        <StatCard label="教学班" value={formatInteger(teachingClasses.length)} hint="教学班总数" />
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
            rows={organizationPage.items.map((organization) => [
              <div
                key={organization.id}
                className="font-medium text-slate-900"
                style={{ paddingLeft: `${organization.depth * 20}px` }}
              >
                {organization.depth > 0 ? "└ " : ""}
                {organization.name}
              </div>,
              orgTypeLabel(organization.type),
              organization.parent?.name ?? "顶级组织",
              `${organization._count.users} / ${organization._count.courses} / ${organization._count.classes}`,
            ])}
          />
          <PaginationControls label="组织" page={organizationPage} pageKey="organizationPage" searchParams={rawSearchParams} />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">课程</h2>
          <DataTable
            headers={["课程", "归属组织", "教学班数"]}
            emptyText="暂无课程数据。"
            rows={coursePage.items.map((course) => [
              <div key="course">
                <div className="font-medium text-slate-900">{course.name}</div>
                <div className="mt-1 text-xs text-slate-500">{course.code}</div>
              </div>,
              course.organization?.name ?? "未归属",
              formatInteger(course._count.teachingClasses),
            ])}
          />
          <PaginationControls label="课程" page={coursePage} pageKey="coursePage" searchParams={rawSearchParams} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">学生</h2>
          <DataTable
            headers={["学生", "学号", "年级/专业", "状态"]}
            emptyText="暂无学生数据。"
            rows={studentPage.items.map((student) => [
              <div key="student">
                <div className="font-medium text-slate-900">{student.name}</div>
                <div className="mt-1 text-xs text-slate-500">{student.email}</div>
              </div>,
              student.studentProfile?.studentNo ?? "未建档",
              `${student.studentProfile?.grade ?? "-"} / ${student.studentProfile?.major ?? "-"}`,
              student.status,
            ])}
          />
          <PaginationControls label="学生" page={studentPage} pageKey="studentPage" searchParams={rawSearchParams} />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">教师</h2>
          <DataTable
            headers={["教师", "工号", "职称", "组织"]}
            emptyText="暂无教师数据。"
            rows={teacherPage.items.map((teacher) => [
              <div key="teacher">
                <div className="font-medium text-slate-900">{teacher.name}</div>
                <div className="mt-1 text-xs text-slate-500">{teacher.email}</div>
              </div>,
              teacher.teacherProfile?.teacherNo ?? "未建档",
              teacher.teacherProfile?.title ?? "未设置",
              teacher.organization.name,
            ])}
          />
          <PaginationControls label="教师" page={teacherPage} pageKey="teacherPage" searchParams={rawSearchParams} />
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">教学班与选课</h2>
        <DataTable
          headers={["教学班", "课程", "教师", "组织", "选课人数"]}
          emptyText="暂无教学班数据。"
          rows={classPage.items.map((teachingClass) => [
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
        <PaginationControls label="教学班" page={classPage} pageKey="classPage" searchParams={rawSearchParams} />
      </div>
    </div>
  );
}
