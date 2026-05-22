import Link from "next/link";

import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import { averageScore } from "@/lib/evaluation/aggregate";

const MIN_SAMPLE_SIZE = 3;

type TeacherResultClass = {
  id: string;
  name: string;
  term: string;
  course: { name: string; code: string };
  assignments: {
    task: { status: string };
    response: {
      status: string;
      answers: { score: number | null }[];
    } | null;
  }[];
};

type TeacherResultsData = {
  classes: TeacherResultClass[];
  isDatabaseConfigured: boolean;
};

async function loadTeacherResults(
  teacherId: string,
): Promise<TeacherResultsData> {
  if (!process.env.DATABASE_URL) {
    return { classes: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const classes = await prisma.teachingClass.findMany({
    where: { teacherId },
    include: {
      course: true,
      assignments: {
        include: {
          task: true,
          response: {
            include: {
              answers: {
                select: { score: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ term: "desc" }, { name: "asc" }],
  });

  return { classes, isDatabaseConfigured: true };
}

function getSubmittedResponses(teachingClass: TeacherResultClass) {
  return teachingClass.assignments
    .map((assignment) => assignment.response)
    .filter(
      (
        response,
      ): response is NonNullable<TeacherResultClass["assignments"][number]["response"]> =>
        response?.status === "SUBMITTED",
    );
}

function getAverageScore(teachingClass: TeacherResultClass) {
  const scores = getSubmittedResponses(teachingClass).flatMap((response) =>
    response.answers.flatMap((answer) =>
      answer.score === null ? [] : [answer.score],
    ),
  );

  return averageScore(scores);
}

function getResultStatus(teachingClass: TeacherResultClass) {
  const submittedCount = getSubmittedResponses(teachingClass).length;

  if (submittedCount < MIN_SAMPLE_SIZE) {
    return "样本不足";
  }

  if (
    teachingClass.assignments.some(
      (assignment) => assignment.task.status === "OPEN",
    )
  ) {
    return "收集中";
  }

  return "已发布";
}

export default async function TeacherResultsPage() {
  const session = await requireRole(["TEACHER"]);
  const { classes, isDatabaseConfigured } = await loadTeacherResults(
    session.user.id,
  );
  const submittedResponseCount = classes.reduce(
    (total, teachingClass) => total + getSubmittedResponses(teachingClass).length,
    0,
  );
  const releasedResultCount = classes.filter(
    (teachingClass) =>
      getSubmittedResponses(teachingClass).length >= MIN_SAMPLE_SIZE,
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <StatusBadge tone="info">评价结果</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          我的评价结果
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          按授课班级查看已提交样本、平均得分和结果发布状态。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载评价结果。
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="结果概览">
        <StatCard label="授课班级" value={classes.length} hint="当前教师名下班级" />
        <StatCard
          label="已提交样本"
          value={submittedResponseCount}
          hint="所有班级提交数"
        />
        <StatCard
          label="可查看结果"
          value={releasedResultCount}
          hint={`至少 ${MIN_SAMPLE_SIZE} 份样本后展示`}
        />
      </section>

      <DataTable
        headers={["课程班", "提交数", "平均分", "结果状态", "操作"]}
        emptyText="暂无评价结果。"
        rows={classes.map((teachingClass) => {
          const submittedCount = getSubmittedResponses(teachingClass).length;
          const hasEnoughSamples = submittedCount >= MIN_SAMPLE_SIZE;

          return [
            <Link
              key="course"
              href={`/teacher/results/${teachingClass.id}`}
              className="block"
            >
              <div className="font-medium text-sky-700 transition hover:text-sky-900">
                {teachingClass.course.name}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {teachingClass.course.code} · {teachingClass.name} ·{" "}
                {teachingClass.term}
              </div>
            </Link>,
            submittedCount,
            hasEnoughSamples ? getAverageScore(teachingClass) : "小样本隐藏",
            <StatusBadge
              key="status"
              tone={hasEnoughSamples ? "success" : "warning"}
            >
              {getResultStatus(teachingClass)}
            </StatusBadge>,
            <Link
              key="detail"
              href={`/teacher/results/${teachingClass.id}`}
              className="font-medium text-sky-700 transition hover:text-sky-900"
            >
              查看详情
            </Link>,
          ];
        })}
      />
    </div>
  );
}
