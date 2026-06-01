import Link from "next/link";

import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  appCachePrefixes,
  cachedJson,
  stableCachePart,
} from "@/lib/cache/app-cache";
import { averageScore } from "@/lib/evaluation/aggregate";

const MIN_SAMPLE_SIZE = 3;

type TeacherResultClass = {
  id: string;
  name: string;
  term: string;
  course: { name: string; code: string };
  averageScore: number;
  hasOpenTask: boolean;
  submittedCount: number;
};

type TeacherResultsData = {
  classes: TeacherResultClass[];
  isDatabaseConfigured: boolean;
};

async function loadTeacherResults(
  teacherId: string,
): Promise<TeacherResultsData> {
  return cachedJson({
    key: `${appCachePrefixes.teacherResults}${stableCachePart(teacherId)}:list`,
    loader: () => loadFreshTeacherResults(teacherId),
    ttlSeconds: 60,
  });
}

async function loadFreshTeacherResults(
  teacherId: string,
): Promise<TeacherResultsData> {
  if (!process.env.DATABASE_URL) {
    return { classes: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const classesBase = await prisma.teachingClass.findMany({
    where: { teacherId },
    select: {
      id: true,
      name: true,
      term: true,
      course: { select: { code: true, name: true } },
    },
    orderBy: [{ term: "desc" }, { name: "asc" }],
  });
  const classIds = classesBase.map((teachingClass) => teachingClass.id);

  if (classIds.length === 0) {
    return { classes: [], isDatabaseConfigured: true };
  }

  const [submittedGroups, openTaskGroups, answerRows] = await Promise.all([
    prisma.evaluationAssignment.groupBy({
      by: ["teachingClassId"],
      _count: { _all: true },
      where: {
        response: { status: "SUBMITTED" },
        teachingClassId: { in: classIds },
      },
    }),
    prisma.evaluationAssignment.groupBy({
      by: ["teachingClassId"],
      _count: { _all: true },
      where: {
        task: { status: "OPEN" },
        teachingClassId: { in: classIds },
      },
    }),
    prisma.answer.findMany({
      select: {
        score: true,
        response: {
          select: {
            assignment: { select: { teachingClassId: true } },
            status: true,
          },
        },
      },
      where: {
        score: { not: null },
        response: {
          status: "SUBMITTED",
          assignment: { teachingClassId: { in: classIds } },
        },
      },
    }),
  ]);
  const submittedByClass = new Map(
    submittedGroups.map((group) => [group.teachingClassId, group._count._all]),
  );
  const openByClass = new Set(openTaskGroups.map((group) => group.teachingClassId));
  const scoresByClass = new Map<string, number[]>();

  answerRows.forEach((answer) => {
    if (answer.score === null) {
      return;
    }

    const teachingClassId = answer.response.assignment.teachingClassId;
    scoresByClass.set(teachingClassId, [
      ...(scoresByClass.get(teachingClassId) ?? []),
      answer.score,
    ]);
  });

  const classes = classesBase.map((teachingClass) => ({
    ...teachingClass,
    averageScore: averageScore(scoresByClass.get(teachingClass.id) ?? []),
    hasOpenTask: openByClass.has(teachingClass.id),
    submittedCount: submittedByClass.get(teachingClass.id) ?? 0,
  }));

  return { classes, isDatabaseConfigured: true };
}

function getResultStatus(teachingClass: TeacherResultClass) {
  if (teachingClass.submittedCount < MIN_SAMPLE_SIZE) {
    return "样本不足";
  }

  if (teachingClass.hasOpenTask) {
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
    (total, teachingClass) => total + teachingClass.submittedCount,
    0,
  );
  const releasedResultCount = classes.filter(
    (teachingClass) => teachingClass.submittedCount >= MIN_SAMPLE_SIZE,
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
          const submittedCount = teachingClass.submittedCount;
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
            hasEnoughSamples ? teachingClass.averageScore : "小样本隐藏",
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
