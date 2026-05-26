import Link from "next/link";
import { notFound } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  buildReportSearchParams,
  buildScoreTrendCoordinates,
  buildScoreTrendPath,
  parseReportQuery,
} from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_REPORT_ROLES,
  SMALL_SAMPLE_THRESHOLD,
  assignmentResponseRate,
  countSubmitted,
  emptyWhenDatabaseMissing,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
  roundMetric,
} from "@/lib/demo-data";

const LOW_RESPONSE_RATE = 60;
const LOW_AVERAGE_SCORE = 3.5;
const CHART_CONFIG = {
  height: 260,
  maxScore: 5,
  padding: 32,
  width: 860,
};

type TeacherReportParams = Promise<{ teacherId: string }>;
type TeacherReportSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type TeacherReportAssignment = {
  id: string;
  status: string;
  submittedAt: Date | null;
  response: {
    status: string;
    answers: { score: number | null }[];
  } | null;
  task: { id: string; name: string; term: string };
  teachingClass: {
    id: string;
    name: string;
    term: string;
    course: { code: string; id: string; name: string };
    organization: { name: string } | null;
  };
};

type TeacherReportDetail = {
  id: string;
  email: string;
  name: string;
  organization: { name: string } | null;
  teacherProfile: { teacherNo: string; title: string | null } | null;
  taughtClasses: { id: string }[];
};

type TeacherEvaluationPoint = {
  assigned: number;
  average: number | null;
  course: string;
  key: string;
  label: string;
  organization: string;
  scoreCount: number;
  scoreTotal: number;
  submitted: number;
  task: string;
  teachingClass: string;
  term: string;
};

function buildAssignmentWhere(
  teacherId: string,
  query: ReturnType<typeof parseReportQuery>,
) {
  const filters: Array<Record<string, unknown>> = [
    { teachingClass: { is: { teacherId } } },
  ];

  if (query.taskId) {
    filters.push({ taskId: query.taskId });
  }

  if (query.term) {
    filters.push({ task: { is: { term: query.term } } });
  }

  if (query.courseId) {
    filters.push({ teachingClass: { is: { courseId: query.courseId } } });
  }

  if (query.organizationId) {
    filters.push({
      teachingClass: { is: { organizationId: query.organizationId } },
    });
  }

  return { AND: filters };
}

function buildEvaluationPoints(assignments: TeacherReportAssignment[]) {
  const buckets = new Map<string, TeacherEvaluationPoint>();

  assignments.forEach((assignment) => {
    const teachingClass = assignment.teachingClass;
    const key = `${assignment.task.id}:${teachingClass.id}`;
    const bucket =
      buckets.get(key) ??
      ({
        assigned: 0,
        average: null,
        course: `${teachingClass.course.name} (${teachingClass.course.code})`,
        key,
        label: `${assignment.task.term} · ${assignment.task.name} · ${teachingClass.name}`,
        organization: teachingClass.organization?.name ?? "未归属",
        scoreCount: 0,
        scoreTotal: 0,
        submitted: 0,
        task: assignment.task.name,
        teachingClass: teachingClass.name,
        term: assignment.task.term || teachingClass.term,
      } satisfies TeacherEvaluationPoint);

    bucket.assigned += 1;

    if (countSubmitted([assignment]) > 0) {
      bucket.submitted += 1;
    }

    assignment.response?.answers.forEach((answer) => {
      if (assignment.response?.status === "SUBMITTED" && answer.score !== null) {
        bucket.scoreCount += 1;
        bucket.scoreTotal += answer.score;
      }
    });

    buckets.set(key, bucket);
  });

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      average:
        bucket.scoreCount === 0
          ? null
          : roundMetric(bucket.scoreTotal / bucket.scoreCount),
    }))
    .sort((first, second) => {
      const termOrder = first.term.localeCompare(second.term, "zh-CN");

      if (termOrder !== 0) {
        return termOrder;
      }

      const taskOrder = first.task.localeCompare(second.task, "zh-CN");

      if (taskOrder !== 0) {
        return taskOrder;
      }

      return first.teachingClass.localeCompare(second.teachingClass, "zh-CN");
    });
}

async function loadTeacherReport(
  teacherId: string,
  query: ReturnType<typeof parseReportQuery>,
): Promise<{
  assignments: TeacherReportAssignment[];
  teacher: TeacherReportDetail | null;
} | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const { prisma } = await import("@/lib/db");
  const [teacher, assignments] = await Promise.all([
    prisma.user.findUnique({
      include: {
        organization: { select: { name: true } },
        taughtClasses: { select: { id: true } },
        teacherProfile: { select: { teacherNo: true, title: true } },
      },
      where: { id: teacherId, role: "TEACHER" },
    }),
    prisma.evaluationAssignment.findMany({
      include: {
        response: {
          include: {
            answers: { select: { score: true } },
          },
        },
        task: { select: { id: true, name: true, term: true } },
        teachingClass: {
          include: {
            course: { select: { code: true, id: true, name: true } },
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { task: { term: "asc" } },
        { task: { name: "asc" } },
        { teachingClass: { name: "asc" } },
      ],
      where: buildAssignmentWhere(teacherId, query),
    }),
  ]);

  return { assignments, teacher };
}

function TrendChart({ points }: { points: TeacherEvaluationPoint[] }) {
  const visiblePoints = points.filter(
    (point) => point.submitted >= SMALL_SAMPLE_THRESHOLD && point.average !== null,
  );
  const scores = visiblePoints.map((point) => point.average ?? 0);
  const coordinates = buildScoreTrendCoordinates(scores, CHART_CONFIG);
  const path = buildScoreTrendPath(scores, CHART_CONFIG);

  if (visiblePoints.length === 0) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">评教分数趋势</h2>
        <p className="mt-4 text-sm text-slate-500">
          当前筛选范围内暂无满足小样本阈值的评教记录，暂不绘制趋势图。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">评教分数趋势</h2>
          <p className="mt-1 text-sm text-slate-500">
            仅绘制提交数不少于 {SMALL_SAMPLE_THRESHOLD} 的记录，满分按 5 分制展示。
          </p>
        </div>
        <div className="text-sm font-medium text-slate-600">
          {formatInteger(visiblePoints.length)} 次可分析评教
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <svg
          aria-label="教师评教分数趋势图"
          className="min-w-[760px]"
          role="img"
          viewBox={`0 0 ${CHART_CONFIG.width} ${CHART_CONFIG.height}`}
        >
          {[5, 4, 3, 2, 1].map((score) => {
            const y =
              CHART_CONFIG.padding +
              ((CHART_CONFIG.maxScore - score) / CHART_CONFIG.maxScore) *
                (CHART_CONFIG.height - CHART_CONFIG.padding * 2);

            return (
              <g key={score}>
                <line
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  x1={CHART_CONFIG.padding}
                  x2={CHART_CONFIG.width - CHART_CONFIG.padding}
                  y1={y}
                  y2={y}
                />
                <text fill="#64748b" fontSize="12" x="8" y={y + 4}>
                  {score}
                </text>
              </g>
            );
          })}
          <path d={path} fill="none" stroke="#0369a1" strokeWidth="3" />
          {coordinates.map((coordinate, index) => (
            <g key={visiblePoints[index].key}>
              <circle
                cx={coordinate.x}
                cy={coordinate.y}
                fill={coordinate.score < LOW_AVERAGE_SCORE ? "#dc2626" : "#0284c7"}
                r="5"
              />
              <text
                fill="#0f172a"
                fontSize="12"
                textAnchor="middle"
                x={coordinate.x}
                y={coordinate.y - 10}
              >
                {coordinate.score}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-3">
        {visiblePoints.slice(-6).map((point) => (
          <div key={point.key} className="truncate">
            <span className="font-medium text-slate-700">{point.average}</span>
            {" · "}
            {point.label}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function TeacherReportDetailPage({
  params,
  searchParams,
}: {
  params: TeacherReportParams;
  searchParams: TeacherReportSearchParams;
}) {
  await requireRole([...ADMIN_REPORT_ROLES]);
  const { teacherId } = await params;
  const query = parseReportQuery(await searchParams);
  const data = await loadTeacherReport(teacherId, query);

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/admin/reports" className="text-sm font-medium text-sky-700">
          返回报表中心
        </Link>
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("教师评教分析")}
        </section>
      </div>
    );
  }

  if (!data?.teacher) {
    notFound();
  }

  const points = buildEvaluationPoints(data.assignments);
  const submittedAssignments = countSubmitted(data.assignments);
  const scoredAnswers = data.assignments.flatMap((assignment) =>
    assignment.response?.answers.flatMap((answer) =>
      answer.score === null ? [] : [answer.score],
    ) ?? [],
  );
  const visibleAverages = points.flatMap((point) =>
    point.submitted >= SMALL_SAMPLE_THRESHOLD && point.average !== null
      ? [point.average]
      : [],
  );
  const overallAverage =
    visibleAverages.length === 0
      ? "小样本隐藏"
      : roundMetric(
          visibleAverages.reduce((total, score) => total + score, 0) /
            visibleAverages.length,
        );
  const lowScoreCount = points.filter(
    (point) =>
      point.submitted >= SMALL_SAMPLE_THRESHOLD &&
      point.average !== null &&
      point.average < LOW_AVERAGE_SCORE,
  ).length;
  const returnParams = buildReportSearchParams(query);
  const returnHref = returnParams.toString()
    ? `/admin/reports?${returnParams.toString()}`
    : "/admin/reports";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href={returnHref} className="text-sm font-medium text-sky-700">
        返回报表中心
      </Link>

      <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <StatusBadge tone="info">教师评教分析</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          {data.teacher.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {data.teacher.organization?.name ?? "未归属组织"} · 工号：
          {data.teacher.teacherProfile?.teacherNo ?? "未建档"} · 职称：
          {data.teacher.teacherProfile?.title ?? "未设置"} · 邮箱：{data.teacher.email}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="授课班级" value={formatInteger(data.teacher.taughtClasses.length)} hint="教师名下教学班" />
        <StatCard label="评教记录" value={formatInteger(points.length)} hint="按任务和教学班聚合" />
        <StatCard label="派发总数" value={formatInteger(data.assignments.length)} hint="当前筛选范围" />
        <StatCard label="整体回收率" value={formatPercent(assignmentResponseRate(data.assignments))} hint={`${formatInteger(submittedAssignments)} / ${formatInteger(data.assignments.length)} 已提交`} />
        <StatCard label="趋势均分" value={overallAverage} hint="按可分析评教次数均值" />
        <StatCard label="低分预警" value={formatInteger(lowScoreCount)} hint={`低于 ${LOW_AVERAGE_SCORE} 分`} />
      </section>

      <TrendChart points={points} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">每次评教明细</h2>
        <DataTable
          headers={["学期", "评价任务", "课程", "教学班", "提交/派发", "回收率", "平均分", "状态"]}
          emptyText="暂无教师评教记录。"
          rows={points.map((point) => {
            const sampleHidden = point.submitted < SMALL_SAMPLE_THRESHOLD;
            const responseRate = assignmentResponseRate(
              Array.from({ length: point.assigned }, (_, index) => ({
                status: index < point.submitted ? "SUBMITTED" : "PENDING",
              })),
            );
            const lowScore =
              !sampleHidden &&
              point.average !== null &&
              point.average < LOW_AVERAGE_SCORE;

            return [
              point.term,
              point.task,
              point.course,
              point.teachingClass,
              `${formatInteger(point.submitted)} / ${formatInteger(point.assigned)}`,
              formatPercent(responseRate),
              sampleHidden || point.average === null ? "小样本隐藏" : point.average,
              <StatusBadge
                key="status"
                tone={
                  sampleHidden || responseRate < LOW_RESPONSE_RATE
                    ? "warning"
                    : lowScore
                      ? "danger"
                      : "success"
                }
              >
                {sampleHidden
                  ? "样本不足"
                  : responseRate < LOW_RESPONSE_RATE
                    ? "低回收"
                    : lowScore
                      ? "低分"
                      : "可分析"}
              </StatusBadge>,
            ];
          })}
        />
        <p className="text-xs text-slate-500">
          计分答案数：{formatInteger(scoredAnswers.length)}。小样本记录不参与趋势图和趋势均分。
        </p>
      </section>
    </div>
  );
}
