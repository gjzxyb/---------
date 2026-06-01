import Link from "next/link";
import { notFound } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  appCachePrefixes,
  cachedJson,
  stableCachePart,
} from "@/lib/cache/app-cache";
import {
  averageScore,
  summarizeQuestionScores,
} from "@/lib/evaluation/aggregate";
import { maskSensitiveText } from "@/lib/admin/reports";

const MIN_SAMPLE_SIZE = 3;

type ResultDetail = {
  id: string;
  name: string;
  term: string;
  course: { name: string; code: string };
  anonymousSuggestions: {
    anonymousNo: string;
    question: string;
    task: string;
    text: string;
  }[];
  averageScore: number;
  distribution: { count: number; score: number }[];
  improvementPlans: {
    id: string;
    title: string;
    action: string;
    status: string;
    dueDate: Date | null;
    evidence: string | null;
    updatedAt: Date;
  }[];
  questionSummaries: { average: number; count: number; title: string }[];
  submittedResponseCount: number;
};

async function loadResultDetail(
  teachingClassId: string,
  teacherId: string,
): Promise<ResultDetail | null> {
  return cachedJson({
    key: `${appCachePrefixes.teacherResults}${stableCachePart({
      teacherId,
      teachingClassId,
    })}:detail`,
    loader: () => loadFreshResultDetail(teachingClassId, teacherId),
    ttlSeconds: 60,
  });
}

async function loadFreshResultDetail(
  teachingClassId: string,
  teacherId: string,
): Promise<ResultDetail | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/db");
  const teachingClass = await prisma.teachingClass.findFirst({
    where: {
      id: teachingClassId,
      teacherId,
    },
    select: {
      id: true,
      name: true,
      term: true,
      course: { select: { code: true, name: true } },
    },
  });

  if (!teachingClass) {
    return null;
  }

  const [responses, improvementPlans] = await Promise.all([
    prisma.evaluationResponse.findMany({
      where: {
        status: "SUBMITTED",
        assignment: { teachingClassId },
      },
      select: {
        assignment: {
          select: {
            task: { select: { name: true, term: true } },
          },
        },
        answers: {
          select: {
            score: true,
            text: true,
            question: {
              select: {
                id: true,
                sortOrder: true,
                title: true,
              },
            },
          },
          orderBy: { question: { sortOrder: "asc" } },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.improvementPlan.findMany({
      where: { teachingClassId },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);
  const scoreAnswers = responses.flatMap((response) =>
    response.answers.flatMap((answer) =>
      answer.score === null
        ? []
        : [{ questionId: answer.question.id, score: answer.score }],
    ),
  );
  const questionTitles = new Map(
    responses.flatMap((response) =>
      response.answers.map((answer) => [
        answer.question.id,
        answer.question.title,
      ]),
    ),
  );
  const anonymousSuggestions = responses.flatMap((response, responseIndex) =>
    response.answers.flatMap((answer) => {
      const text = answer.text?.trim();

      if (!text) {
        return [];
      }

      return [
        {
          anonymousNo: `匿名反馈 ${responseIndex + 1}`,
          question: answer.question.title,
          task: `${response.assignment.task.term} · ${response.assignment.task.name}`,
          text: maskSensitiveText(text),
        },
      ];
    }),
  );
  const distribution = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: scoreAnswers.filter((answer) => answer.score === score).length,
  }));
  const questionSummaries = summarizeQuestionScores(scoreAnswers).map(
    (summary) => ({
      average: summary.average,
      count: summary.count,
      title: questionTitles.get(summary.questionId) ?? summary.questionId,
    }),
  );

  return {
    ...teachingClass,
    anonymousSuggestions,
    averageScore: averageScore(scoreAnswers.map((answer) => answer.score)),
    distribution,
    improvementPlans,
    questionSummaries,
    submittedResponseCount: responses.length,
  };
}

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function TeacherResultDetailPage({
  params,
}: {
  params: Promise<{ teachingClassId: string }>;
}) {
  const session = await requireRole(["TEACHER"]);
  const { teachingClassId } = await params;
  const teachingClass = await loadResultDetail(
    teachingClassId,
    session.user.id,
  );

  if (!process.env.DATABASE_URL) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/teacher/results"
          className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
        >
          返回评价结果
        </Link>
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载评价详情。
        </section>
      </div>
    );
  }

  if (!teachingClass) {
    notFound();
  }

  const hasEnoughSamples =
    teachingClass.submittedResponseCount >= MIN_SAMPLE_SIZE;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/teacher/results"
        className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
      >
        返回评价结果
      </Link>

      <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusBadge tone={hasEnoughSamples ? "success" : "warning"}>
              {hasEnoughSamples ? "结果已展示" : "样本不足"}
            </StatusBadge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              {teachingClass.course.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {teachingClass.course.code} · {teachingClass.name} ·{" "}
              {teachingClass.term}
            </p>
          </div>
          <Link
            href="/teacher/improvements"
            className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            新建改进计划
          </Link>
        </div>
      </section>

      {!hasEnoughSamples ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          已提交样本少于 {MIN_SAMPLE_SIZE} 份，分数和题目均分已隐藏；建议内容仍以匿名方式展示。
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3" aria-label="评价指标">
        <StatCard
          label="已提交样本"
          value={teachingClass.submittedResponseCount}
          hint="仅统计提交状态"
        />
        <StatCard
          label="平均分"
          value={hasEnoughSamples ? teachingClass.averageScore : "-"}
          hint={hasEnoughSamples ? "全部量表题平均" : "小样本隐藏"}
        />
        <StatCard
          label="改进计划"
          value={teachingClass.improvementPlans.length}
          hint="该课程班关联计划"
        />
      </section>

      {hasEnoughSamples ? (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-950">
              题目级平均
            </h2>
            <DataTable
              headers={["题目", "样本数", "平均分"]}
              emptyText="暂无量表题得分。"
              rows={teachingClass.questionSummaries.map((summary) => [
                summary.title,
                summary.count,
                summary.average,
              ])}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-950">分数分布</h2>
            <DataTable
              headers={["分数", "次数"]}
              rows={teachingClass.distribution.map((bucket) => [
                `${bucket.score} 分`,
                bucket.count,
              ])}
            />
          </section>

        </>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">
          学生建议内容
        </h2>
        <DataTable
          headers={["匿名序号", "评价任务", "题目", "建议内容"]}
          emptyText="暂无建议内容。"
          rows={teachingClass.anonymousSuggestions.map((suggestion) => [
            suggestion.anonymousNo,
            suggestion.task,
            suggestion.question,
            suggestion.text,
          ])}
        />
        <p className="text-xs text-slate-500">
          该列表不展示学生姓名、学号、邮箱或其他身份字段；建议内容中的邮箱、手机号和连续长数字已自动脱敏。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">改进计划</h2>
        <DataTable
          headers={["标题", "状态", "截止日期", "行动", "佐证"]}
          emptyText="暂无改进计划。"
          rows={teachingClass.improvementPlans.map((plan) => [
            <div key="title">
              <div className="font-medium text-slate-900">{plan.title}</div>
              <div className="mt-1 text-xs text-slate-500">
                更新于 {formatDate(plan.updatedAt)}
              </div>
            </div>,
            plan.status,
            formatDate(plan.dueDate),
            plan.action,
            plan.evidence ?? "-",
          ])}
        />
      </section>
    </div>
  );
}
