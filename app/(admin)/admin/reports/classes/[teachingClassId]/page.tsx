import Link from "next/link";
import { notFound } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  buildReportSearchParams,
  maskSensitiveText,
  parseReportQuery,
} from "@/lib/admin/reports";
import {
  ADMIN_REPORT_ROLES,
  assignmentStatusLabel,
  countSubmitted,
  emptyWhenDatabaseMissing,
  formatDateTime,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
} from "@/lib/demo-data";
import { averageResponseScore, responseScoreTotal } from "@/lib/evaluation/scoring";

type ClassReportDetailParams = Promise<{ teachingClassId: string }>;
type ClassReportDetailSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type ClassReportDetail = {
  id: string;
  name: string;
  term: string;
  course: { code: string; name: string };
  teacher: { name: string };
  enrollments: {
    student: {
      id: string;
      email: string;
      name: string;
      studentProfile: { studentNo: string | null } | null;
    };
  }[];
  assignments: {
    evaluatorId: string;
    id: string;
    status: string;
    submittedAt: Date | null;
    task: { id: string; name: string; term: string };
    response: {
      status: string;
      submittedAt: Date | null;
      answers: {
        score: number | null;
        text: string | null;
        question: { maxScore: number | null; sortOrder: number; title: string; type: string };
      }[];
    } | null;
  }[];
};

type ClassReportAssignment = ClassReportDetail["assignments"][number];
type ClassReportStudent = ClassReportDetail["enrollments"][number]["student"];
type ClassReportDetailRow = {
  assignment: ClassReportAssignment | null;
  student: ClassReportStudent;
};

function scoreDetails(
  answers: NonNullable<ClassReportDetail["assignments"][number]["response"]>["answers"],
) {
  const scoreAnswers = answers
    .filter((answer) => answer.score !== null)
    .sort((first, second) => first.question.sortOrder - second.question.sortOrder);

  if (scoreAnswers.length === 0) {
    return "-";
  }

  return scoreAnswers
    .map((answer) => `${answer.question.title}：${answer.score}`)
    .join("；");
}

function textDetails(
  answers: NonNullable<ClassReportDetail["assignments"][number]["response"]>["answers"],
) {
  const textAnswers = answers.flatMap((answer) => {
    const text = answer.text?.trim();

    return text ? [`${answer.question.title}：${maskSensitiveText(text)}`] : [];
  });

  return textAnswers.length > 0 ? textAnswers.join("；") : "-";
}

async function loadClassReportDetail(
  teachingClassId: string,
  query: ReturnType<typeof parseReportQuery>,
): Promise<ClassReportDetail | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const { prisma } = await import("@/lib/db");

  return prisma.teachingClass.findUnique({
    include: {
      assignments: {
        include: {
          response: {
            include: {
              answers: {
                include: {
                  question: {
                    select: { maxScore: true, sortOrder: true, title: true, type: true },
                  },
                },
                orderBy: { question: { sortOrder: "asc" } },
              },
            },
          },
          task: { select: { id: true, name: true, term: true } },
        },
        orderBy: [{ task: { term: "desc" } }, { assignedAt: "desc" }],
        where: {
          ...(query.taskId ? { taskId: query.taskId } : {}),
          ...(query.term ? { task: { term: query.term } } : {}),
        },
      },
      course: { select: { code: true, name: true } },
      enrollments: {
        include: {
          student: {
            select: {
              email: true,
              id: true,
              name: true,
              studentProfile: { select: { studentNo: true } },
            },
          },
        },
        orderBy: { student: { name: "asc" } },
      },
      teacher: { select: { name: true } },
    },
    where: { id: teachingClassId },
  });
}

export default async function ClassReportDetailPage({
  params,
  searchParams,
}: {
  params: ClassReportDetailParams;
  searchParams: ClassReportDetailSearchParams;
}) {
  await requireRole([...ADMIN_REPORT_ROLES]);
  const { teachingClassId } = await params;
  const query = parseReportQuery(await searchParams);
  const teachingClass = await loadClassReportDetail(teachingClassId, query);

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/admin/reports" className="text-sm font-medium text-sky-700">
          返回报表中心
        </Link>
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("教学班报表明细")}
        </section>
      </div>
    );
  }

  if (!teachingClass) {
    notFound();
  }

  const assignmentsByStudent = new Map<string, typeof teachingClass.assignments>();

  teachingClass.assignments.forEach((assignment) => {
    assignmentsByStudent.set(assignment.evaluatorId, [
      ...(assignmentsByStudent.get(assignment.evaluatorId) ?? []),
      assignment,
    ]);
  });

  const detailRows: ClassReportDetailRow[] = teachingClass.enrollments.flatMap((enrollment) => {
    const assignments = assignmentsByStudent.get(enrollment.student.id) ?? [];

    if (assignments.length === 0) {
      return [
        {
          assignment: null,
          student: enrollment.student,
        },
      ];
    }

    return assignments.map((assignment): ClassReportDetailRow => ({
      assignment,
      student: enrollment.student,
    }));
  });
  const submittedCount = countSubmitted(teachingClass.assignments);
  const responseScores = teachingClass.assignments.flatMap((assignment) => {
    if (assignment.response?.status !== "SUBMITTED") {
      return [];
    }

    const scoreSummary = responseScoreTotal(assignment.response.answers);

    return scoreSummary === null ? [] : [scoreSummary.total];
  });
  const exportParams = buildReportSearchParams(
    {},
    {
      taskId: query.taskId,
      term: query.term,
    },
  );
  const detailExportHref = exportParams.toString()
    ? `/admin/reports/classes/${teachingClassId}/export?${exportParams.toString()}`
    : `/admin/reports/classes/${teachingClassId}/export`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/reports" className="text-sm font-medium text-sky-700">
          返回报表中心
        </Link>
        <Link
          href={detailExportHref}
          className="inline-flex w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          导出学生评教明细 Excel
        </Link>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <StatusBadge tone="info">教学班明细</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          {teachingClass.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {teachingClass.term} · {teachingClass.course.name} ({teachingClass.course.code}) · 任课教师：{teachingClass.teacher.name}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="选课学生" value={formatInteger(teachingClass.enrollments.length)} hint="该教学班选课名单" />
        <StatCard label="派发记录" value={formatInteger(teachingClass.assignments.length)} hint="当前筛选范围" />
        <StatCard label="提交率" value={formatPercent(teachingClass.assignments.length ? (submittedCount / teachingClass.assignments.length) * 100 : 0)} hint={`${formatInteger(submittedCount)} / ${formatInteger(teachingClass.assignments.length)} 已提交`} />
        <StatCard label="生均得分" value={averageResponseScore(responseScores)} hint="已提交答卷总分平均" />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">学生评教明细</h2>
        <DataTable
          headers={["学生", "学号", "评价任务", "状态", "提交时间", "答卷总分", "评分明细", "文本意见"]}
          emptyText="暂无学生评教数据。"
          rows={detailRows.map(({ assignment, student }) => {
            const response = assignment?.response;
            const scoreSummary = response ? responseScoreTotal(response.answers) : null;

            return [
              <div key="student">
                <div className="font-medium text-slate-900">{student.name}</div>
                <div className="mt-1 text-xs text-slate-500">{student.email}</div>
              </div>,
              student.studentProfile?.studentNo ?? "未建档",
              assignment ? `${assignment.task.term} · ${assignment.task.name}` : "未派发",
              assignment ? assignmentStatusLabel(assignment.status) : "未派发",
              formatDateTime(response?.submittedAt ?? assignment?.submittedAt),
              response?.status === "SUBMITTED" ? scoreSummary?.total ?? "-" : "-",
              response?.status === "SUBMITTED" ? scoreDetails(response.answers) : "-",
              response?.status === "SUBMITTED" ? textDetails(response.answers) : "-",
            ];
          })}
        />
      </section>
    </div>
  );
}
