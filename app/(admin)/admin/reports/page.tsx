import Link from "next/link";

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
  SMALL_SAMPLE_THRESHOLD,
  assignmentResponseRate,
  countSubmitted,
  emptyWhenDatabaseMissing,
  formatDateTime,
  formatInteger,
  formatPercent,
  isDatabaseConfigured,
  roundMetric,
} from "@/lib/demo-data";

const LOW_RESPONSE_RATE = 60;
const LOW_AVERAGE_SCORE = 3.5;

type ReportsPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type ReportOrganization = {
  id: string;
  name: string;
  type: string;
  parent?: ReportOrganization | null;
};

type ReportAssignment = {
  id: string;
  status: string;
  submittedAt: Date | null;
  response: { status: string } | null;
  task: { id: string; name: string; term: string };
  teachingClass: {
    id: string;
    name: string;
    term: string;
    course: { id: string; name: string; code: string };
    teacher: { id: string; name: string };
    organization: ReportOrganization | null;
  };
};

type ReportResponse = {
  id: string;
  submittedAt: Date | null;
  answers: {
    score: number | null;
    text: string | null;
    question: { id: string; title: string; type: string };
  }[];
  assignment: ReportAssignment;
};

type ReportBucket = {
  assigned: number;
  key: string;
  label: string;
  scoreCount: number;
  scoreTotal: number;
  submitted: number;
};

type ReportData = {
  assignments: ReportAssignment[];
  courses: Array<{ id: string; code: string; name: string }>;
  isDatabaseConfigured: boolean;
  organizations: Array<{ id: string; name: string }>;
  responses: ReportResponse[];
  tasks: Array<{ id: string; name: string; term: string }>;
  teachers: Array<{ id: string; name: string }>;
  terms: string[];
};

function findOrganizationByType(
  organization: ReportOrganization | null,
  type: string,
) {
  let current: ReportOrganization | null | undefined = organization;

  while (current) {
    if (current.type === type) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function resolveOrganization(
  assignment: ReportAssignment,
  type: string,
  fallbackKey: string,
  fallbackLabel: string,
) {
  const matchedOrganization = findOrganizationByType(
    assignment.teachingClass.organization,
    type,
  );

  if (matchedOrganization) {
    return { key: matchedOrganization.id, label: matchedOrganization.name };
  }

  return { key: fallbackKey, label: fallbackLabel };
}

function getBucket(buckets: Map<string, ReportBucket>, key: string, label: string) {
  const bucket =
    buckets.get(key) ??
    ({
      assigned: 0,
      key,
      label,
      scoreCount: 0,
      scoreTotal: 0,
      submitted: 0,
    } satisfies ReportBucket);

  buckets.set(key, bucket);

  return bucket;
}

function addAssignmentToBucket(
  buckets: Map<string, ReportBucket>,
  key: string,
  label: string,
  assignment: ReportAssignment,
) {
  const bucket = getBucket(buckets, key, label);

  bucket.assigned += 1;

  if (countSubmitted([assignment]) > 0) {
    bucket.submitted += 1;
  }
}

function addResponseScoresToBucket(
  buckets: Map<string, ReportBucket>,
  key: string,
  label: string,
  response: ReportResponse,
) {
  const bucket = getBucket(buckets, key, label);

  response.answers.forEach((answer) => {
    if (answer.score !== null) {
      bucket.scoreCount += 1;
      bucket.scoreTotal += answer.score;
    }
  });
}

function finalizeBuckets(buckets: Map<string, ReportBucket>) {
  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      average:
        bucket.scoreCount === 0
          ? 0
          : roundMetric(bucket.scoreTotal / bucket.scoreCount),
      responseRate: assignmentResponseRate(
        Array.from({ length: bucket.assigned }, (_, index) => ({
          status: index < bucket.submitted ? "SUBMITTED" : "PENDING",
        })),
      ),
    }))
    .sort((first, second) => {
      if (second.assigned !== first.assigned) {
        return second.assigned - first.assigned;
      }

      return first.label.localeCompare(second.label, "zh-CN");
    });
}

function bucketRows(aggregates: ReturnType<typeof finalizeBuckets>) {
  return aggregates.map((aggregate) => {
    const sampleHidden = aggregate.submitted < SMALL_SAMPLE_THRESHOLD;

    return [
      <div key="label" className="font-medium text-slate-900">
        {aggregate.label}
      </div>,
      `${formatInteger(aggregate.submitted)} / ${formatInteger(aggregate.assigned)}`,
      formatPercent(aggregate.responseRate),
      sampleHidden ? "小样本隐藏" : aggregate.average,
      <StatusBadge
        key="status"
        tone={
          sampleHidden || aggregate.responseRate < LOW_RESPONSE_RATE
            ? "warning"
            : "success"
        }
      >
        {sampleHidden
          ? "样本不足"
          : aggregate.responseRate < LOW_RESPONSE_RATE
            ? "低回收"
            : "可分析"}
      </StatusBadge>,
    ];
  });
}

function classBucketRows(
  aggregates: ReturnType<typeof finalizeBuckets>,
  query: ReturnType<typeof parseReportQuery>,
) {
  return aggregates.map((aggregate) => {
    const sampleHidden = aggregate.submitted < SMALL_SAMPLE_THRESHOLD;
    const detailParams = buildReportSearchParams(
      {},
      {
        taskId: query.taskId,
        term: query.term,
      },
    );
    const detailHref = detailParams.toString()
      ? `/admin/reports/classes/${aggregate.key}?${detailParams.toString()}`
      : `/admin/reports/classes/${aggregate.key}`;

    return [
      <Link
        key="label"
        href={detailHref}
        className="font-medium text-sky-700 hover:text-sky-900"
      >
        {aggregate.label}
      </Link>,
      `${formatInteger(aggregate.submitted)} / ${formatInteger(aggregate.assigned)}`,
      formatPercent(aggregate.responseRate),
      sampleHidden ? "小样本隐藏" : aggregate.average,
      <StatusBadge
        key="status"
        tone={
          sampleHidden || aggregate.responseRate < LOW_RESPONSE_RATE
            ? "warning"
            : "success"
        }
      >
        {sampleHidden
          ? "样本不足"
          : aggregate.responseRate < LOW_RESPONSE_RATE
            ? "低回收"
            : "可分析"}
      </StatusBadge>,
    ];
  });
}

function buildAggregates(
  assignments: ReportAssignment[],
  responses: ReportResponse[],
) {
  const schools = new Map<string, ReportBucket>();
  const departments = new Map<string, ReportBucket>();
  const teachers = new Map<string, ReportBucket>();
  const courses = new Map<string, ReportBucket>();
  const classes = new Map<string, ReportBucket>();

  assignments.forEach((assignment) => {
    const school = resolveOrganization(
      assignment,
      "SCHOOL",
      "unknown-school",
      "未归属学校",
    );
    const department = resolveOrganization(
      assignment,
      "DEPARTMENT",
      "unknown-department",
      "未归属院系",
    );

    addAssignmentToBucket(schools, school.key, school.label, assignment);
    addAssignmentToBucket(departments, department.key, department.label, assignment);
    addAssignmentToBucket(
      teachers,
      assignment.teachingClass.teacher.id,
      assignment.teachingClass.teacher.name,
      assignment,
    );
    addAssignmentToBucket(
      courses,
      assignment.teachingClass.course.id,
      `${assignment.teachingClass.course.name} (${assignment.teachingClass.course.code})`,
      assignment,
    );
    addAssignmentToBucket(
      classes,
      assignment.teachingClass.id,
      `${assignment.teachingClass.name} · ${assignment.teachingClass.term}`,
      assignment,
    );
  });

  responses.forEach((response) => {
    const assignment = response.assignment;
    const school = resolveOrganization(
      assignment,
      "SCHOOL",
      "unknown-school",
      "未归属学校",
    );
    const department = resolveOrganization(
      assignment,
      "DEPARTMENT",
      "unknown-department",
      "未归属院系",
    );

    addResponseScoresToBucket(schools, school.key, school.label, response);
    addResponseScoresToBucket(departments, department.key, department.label, response);
    addResponseScoresToBucket(
      teachers,
      assignment.teachingClass.teacher.id,
      assignment.teachingClass.teacher.name,
      response,
    );
    addResponseScoresToBucket(
      courses,
      assignment.teachingClass.course.id,
      `${assignment.teachingClass.course.name} (${assignment.teachingClass.course.code})`,
      response,
    );
    addResponseScoresToBucket(
      classes,
      assignment.teachingClass.id,
      `${assignment.teachingClass.name} · ${assignment.teachingClass.term}`,
      response,
    );
  });

  return {
    classes: finalizeBuckets(classes),
    courses: finalizeBuckets(courses),
    departments: finalizeBuckets(departments),
    schools: finalizeBuckets(schools),
    teachers: finalizeBuckets(teachers),
  };
}

function buildQuestionSummaries(responses: ReportResponse[]) {
  const questions = new Map<
    string,
    { average: number; count: number; scoreTotal: number; textCount: number; title: string; type: string }
  >();

  responses.forEach((response) => {
    response.answers.forEach((answer) => {
      const summary =
        questions.get(answer.question.id) ??
        ({
          average: 0,
          count: 0,
          scoreTotal: 0,
          textCount: 0,
          title: answer.question.title,
          type: answer.question.type,
        });

      if (answer.score !== null) {
        summary.count += 1;
        summary.scoreTotal += answer.score;
        summary.average = roundMetric(summary.scoreTotal / summary.count);
      }

      if (answer.text?.trim()) {
        summary.textCount += 1;
      }

      questions.set(answer.question.id, summary);
    });
  });

  return Array.from(questions.values()).sort(
    (first, second) => second.count - first.count || first.title.localeCompare(second.title, "zh-CN"),
  );
}

function buildTextComments(responses: ReportResponse[]) {
  return responses.flatMap((response) =>
    response.answers.flatMap((answer) => {
      const text = answer.text?.trim();

      if (!text) {
        return [];
      }

      return [
        {
          course: response.assignment.teachingClass.course.name,
          question: answer.question.title,
          submittedAt: response.submittedAt,
          teachingClass: response.assignment.teachingClass.name,
          text: maskSensitiveText(text),
        },
      ];
    }),
  );
}

function buildWarnings(aggregates: ReturnType<typeof buildAggregates>) {
  return [...aggregates.classes, ...aggregates.teachers, ...aggregates.courses]
    .flatMap((aggregate) => {
      const warnings = [];

      if (aggregate.assigned > 0 && aggregate.responseRate < LOW_RESPONSE_RATE) {
        warnings.push({
          detail: `回收率 ${formatPercent(aggregate.responseRate)}，低于 ${LOW_RESPONSE_RATE}%`,
          label: aggregate.label,
          level: "warning",
          type: "低回收率",
        });
      }

      if (aggregate.submitted > 0 && aggregate.submitted < SMALL_SAMPLE_THRESHOLD) {
        warnings.push({
          detail: `提交 ${formatInteger(aggregate.submitted)} 份，低于小样本阈值 ${SMALL_SAMPLE_THRESHOLD}`,
          label: aggregate.label,
          level: "warning",
          type: "小样本风险",
        });
      }

      if (
        aggregate.submitted >= SMALL_SAMPLE_THRESHOLD &&
        aggregate.average > 0 &&
        aggregate.average < LOW_AVERAGE_SCORE
      ) {
        warnings.push({
          detail: `平均分 ${aggregate.average}，低于 ${LOW_AVERAGE_SCORE}`,
          label: aggregate.label,
          level: "danger",
          type: "低分预警",
        });
      }

      return warnings;
    })
    .slice(0, 12);
}

function buildAssignmentWhere(query: ReturnType<typeof parseReportQuery>) {
  const filters = [];

  if (query.taskId) {
    filters.push({ taskId: query.taskId });
  }

  if (query.term) {
    filters.push({ task: { is: { term: query.term } } });
  }

  if (query.courseId) {
    filters.push({ teachingClass: { is: { courseId: query.courseId } } });
  }

  if (query.teacherId) {
    filters.push({ teachingClass: { is: { teacherId: query.teacherId } } });
  }

  if (query.organizationId) {
    filters.push({
      teachingClass: { is: { organizationId: query.organizationId } },
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

async function loadReportData(
  query: ReturnType<typeof parseReportQuery>,
): Promise<ReportData> {
  if (!isDatabaseConfigured()) {
    return {
      assignments: [],
      courses: [],
      isDatabaseConfigured: false,
      organizations: [],
      responses: [],
      tasks: [],
      teachers: [],
      terms: [],
    };
  }

  const { prisma } = await import("@/lib/db");
  const assignmentWhere = buildAssignmentWhere(query);
  const [
    assignments,
    responses,
    tasks,
    courses,
    teachers,
    organizations,
    teachingClassTerms,
  ] = await Promise.all([
    prisma.evaluationAssignment.findMany({
      include: {
        response: { select: { status: true } },
        task: { select: { id: true, name: true, term: true } },
        teachingClass: {
          include: {
            course: { select: { code: true, id: true, name: true } },
            organization: {
              select: {
                id: true,
                name: true,
                parent: {
                  select: {
                    id: true,
                    name: true,
                    parent: { select: { id: true, name: true, type: true } },
                    type: true,
                  },
                },
                type: true,
              },
            },
            teacher: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
      where: assignmentWhere,
    }),
    prisma.evaluationResponse.findMany({
      include: {
        answers: {
          select: {
            question: { select: { id: true, title: true, type: true } },
            score: true,
            text: true,
          },
        },
        assignment: {
          include: {
            response: { select: { status: true } },
            task: { select: { id: true, name: true, term: true } },
            teachingClass: {
              include: {
                course: { select: { code: true, id: true, name: true } },
                organization: {
                  select: {
                    id: true,
                    name: true,
                    parent: {
                      select: {
                        id: true,
                        name: true,
                        parent: { select: { id: true, name: true, type: true } },
                        type: true,
                      },
                    },
                    type: true,
                  },
                },
                teacher: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      where: {
        assignment: { is: assignmentWhere },
        status: "SUBMITTED",
      },
    }),
    prisma.evaluationTask.findMany({
      orderBy: [{ term: "desc" }, { name: "asc" }],
      select: { id: true, name: true, term: true },
    }),
    prisma.course.findMany({
      orderBy: { code: "asc" },
      select: { code: true, id: true, name: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      where: { role: "TEACHER" },
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.teachingClass.findMany({
      orderBy: { term: "desc" },
      select: { term: true },
    }),
  ]);
  const terms = Array.from(
    new Set([...tasks.map((task) => task.term), ...teachingClassTerms.map((item) => item.term)]),
  ).filter(Boolean);

  return {
    assignments,
    courses,
    isDatabaseConfigured: true,
    organizations,
    responses,
    tasks,
    teachers,
    terms,
  };
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: ReportsPageSearchParams;
}) {
  await requireRole([...ADMIN_REPORT_ROLES]);
  const query = parseReportQuery(await searchParams);
  const {
    assignments,
    courses,
    isDatabaseConfigured,
    organizations,
    responses,
    tasks,
    teachers,
    terms,
  } = await loadReportData(query);
  const aggregates = buildAggregates(assignments, responses);
  const warnings = buildWarnings(aggregates);
  const scoredAnswers = responses.flatMap((response) =>
    response.answers.flatMap((answer) =>
      answer.score === null ? [] : [answer.score],
    ),
  );
  const overallAverage =
    responses.length < SMALL_SAMPLE_THRESHOLD || scoredAnswers.length === 0
      ? 0
      : roundMetric(
          scoredAnswers.reduce((total, score) => total + score, 0) /
            scoredAnswers.length,
        );
  const submittedAssignments = countSubmitted(assignments);
  const questionSummaries = buildQuestionSummaries(responses);
  const textComments = buildTextComments(responses);
  const exportHref = `/admin/reports/export?${buildReportSearchParams(query).toString()}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge tone="info">统计报告</StatusBadge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            报表中心
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            按学校、院系、教师、课程、教学班、题目和文本意见汇总评教结果，支持筛选、预警和 CSV 导出。
          </p>
        </div>
        <Link
          href={exportHref}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          导出 CSV
        </Link>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("统计报告")}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="p-5">
          <h2 className="text-base font-semibold text-slate-950">自定义报表筛选</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              学期
              <select name="term" defaultValue={query.term ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部学期</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              评价任务
              <select name="taskId" defaultValue={query.taskId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部任务</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.term} · {task.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              组织
              <select name="organizationId" defaultValue={query.organizationId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部组织</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              教师
              <select name="teacherId" defaultValue={query.teacherId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部教师</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              课程
              <select name="courseId" defaultValue={query.courseId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部课程</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.code})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                查询
              </button>
              <Link href="/admin/reports" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                重置
              </Link>
            </div>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6" aria-label="报告概览">
        <StatCard label="派发总数" value={formatInteger(assignments.length)} hint="当前筛选范围" />
        <StatCard label="已提交" value={formatInteger(submittedAssignments)} hint="提交或响应已完成" />
        <StatCard label="整体回收率" value={formatPercent(assignmentResponseRate(assignments))} hint="已提交 / 派发" />
        <StatCard label="计分答案" value={formatInteger(scoredAnswers.length)} hint="剔除文本题与空分值" />
        <StatCard
          label="整体平均分"
          value={responses.length < SMALL_SAMPLE_THRESHOLD ? "小样本隐藏" : overallAverage}
          hint={responses.length < SMALL_SAMPLE_THRESHOLD ? `少于 ${SMALL_SAMPLE_THRESHOLD} 份提交不显示` : "按计分答案计算"}
        />
        <StatCard label="预警项" value={formatInteger(warnings.length)} hint="低回收、小样本、低分" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">学校报表</h2>
          <DataTable headers={["学校", "提交/派发", "回收率", "平均分", "状态"]} emptyText="暂无学校汇总。" rows={bucketRows(aggregates.schools)} />
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">院系报表</h2>
          <DataTable headers={["院系", "提交/派发", "回收率", "平均分", "状态"]} emptyText="暂无院系汇总。" rows={bucketRows(aggregates.departments)} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">教师报表</h2>
          <DataTable headers={["教师", "提交/派发", "回收率", "平均分", "状态"]} emptyText="暂无教师汇总。" rows={bucketRows(aggregates.teachers)} />
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">课程报表</h2>
          <DataTable headers={["课程", "提交/派发", "回收率", "平均分", "状态"]} emptyText="暂无课程汇总。" rows={bucketRows(aggregates.courses)} />
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">教学班报表</h2>
        <DataTable headers={["教学班", "提交/派发", "回收率", "平均分", "状态"]} emptyText="暂无教学班汇总。" rows={classBucketRows(aggregates.classes, query)} />
        <p className="text-xs text-slate-500">
          点击教学班名称可查看该班所有学生的评教明细。
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">题目维度分析</h2>
          <DataTable
            headers={["题目", "类型", "计分样本", "平均分", "文本意见"]}
            emptyText="暂无题目统计。"
            rows={questionSummaries.map((question) => [
              <div key="question" className="font-medium text-slate-900">
                {question.title}
              </div>,
              question.type === "SCALE" ? "量表题" : "开放题",
              formatInteger(question.count),
              question.count < SMALL_SAMPLE_THRESHOLD ? "小样本隐藏" : question.average,
              formatInteger(question.textCount),
            ])}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">异常预警</h2>
          <DataTable
            headers={["类型", "对象", "详情", "等级"]}
            emptyText="暂无预警。"
            rows={warnings.map((warning) => [
              warning.type,
              warning.label,
              warning.detail,
              <StatusBadge key="level" tone={warning.level === "danger" ? "danger" : "warning"}>
                {warning.level === "danger" ? "高" : "中"}
              </StatusBadge>,
            ])}
          />
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">文本意见治理</h2>
        <DataTable
          headers={["提交时间", "课程/教学班", "题目", "脱敏意见"]}
          emptyText="暂无文本意见。"
          rows={textComments.slice(0, 30).map((comment) => [
            formatDateTime(comment.submittedAt),
            `${comment.course} / ${comment.teachingClass}`,
            comment.question,
            comment.text,
          ])}
        />
        <p className="text-xs text-slate-500">
          文本意见已隐藏邮箱、手机号和连续长数字，列表最多展示最近 30 条。
        </p>
      </div>
    </div>
  );
}
