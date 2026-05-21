import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_REPORT_ROLES,
  SMALL_SAMPLE_THRESHOLD,
  addAggregateScore,
  emptyWhenDatabaseMissing,
  finalizeAggregates,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type SubmittedResponse = {
  id: string;
  submittedAt: Date | null;
  answers: { score: number | null }[];
  assignment: {
    teachingClass: {
      id: string;
      name: string;
      term: string;
      course: { id: string; name: string; code: string };
      teacher: { id: string; name: string };
      organization: ReportOrganization | null;
    };
  };
};

type ReportOrganization = {
  id: string;
  name: string;
  type: string;
  parent?: ReportOrganization | null;
};

type ReportData = {
  responses: SubmittedResponse[];
  isDatabaseConfigured: boolean;
};

async function loadReportData(): Promise<ReportData> {
  if (!isDatabaseConfigured()) {
    return { responses: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const responses = await prisma.evaluationResponse.findMany({
    where: { status: "SUBMITTED" },
    include: {
      answers: { select: { score: true } },
      assignment: {
        include: {
          teachingClass: {
            include: {
              course: { select: { id: true, name: true, code: true } },
              teacher: { select: { id: true, name: true } },
              organization: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      type: true,
                      parent: {
                        select: {
                          id: true,
                          name: true,
                          type: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return { responses, isDatabaseConfigured: true };
}

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
  response: SubmittedResponse,
  type: string,
  fallbackKey: string,
  fallbackLabel: string,
) {
  const organization = response.assignment.teachingClass.organization;
  const matchedOrganization = findOrganizationByType(organization, type);

  if (matchedOrganization) {
    return { key: matchedOrganization.id, label: matchedOrganization.name };
  }

  return { key: fallbackKey, label: fallbackLabel };
}

function buildAggregates(responses: SubmittedResponse[]) {
  const schoolBuckets = new Map();
  const departmentBuckets = new Map();
  const teacherBuckets = new Map();
  const courseBuckets = new Map();
  const classBuckets = new Map();

  responses.forEach((response) => {
    const teachingClass = response.assignment.teachingClass;
    const school = resolveOrganization(
      response,
      "SCHOOL",
      "unknown-school",
      "未归属学校",
    );
    const department = resolveOrganization(
      response,
      "DEPARTMENT",
      "unknown-department",
      "未归属院系",
    );

    addAggregateScore(schoolBuckets, school.key, school.label, response.answers);
    addAggregateScore(departmentBuckets, department.key, department.label, response.answers);
    addAggregateScore(
      teacherBuckets,
      teachingClass.teacher.id,
      teachingClass.teacher.name,
      response.answers,
    );
    addAggregateScore(
      courseBuckets,
      teachingClass.course.id,
      `${teachingClass.course.name} (${teachingClass.course.code})`,
      response.answers,
    );
    addAggregateScore(
      classBuckets,
      teachingClass.id,
      `${teachingClass.name} · ${teachingClass.term}`,
      response.answers,
    );
  });

  return {
    schools: finalizeAggregates(schoolBuckets),
    departments: finalizeAggregates(departmentBuckets),
    teachers: finalizeAggregates(teacherBuckets),
    courses: finalizeAggregates(courseBuckets),
    classes: finalizeAggregates(classBuckets),
  };
}

function aggregateRows(aggregates: ReturnType<typeof finalizeAggregates>) {
  return aggregates.map((aggregate) => [
    <div key="label" className="font-medium text-slate-900">
      {aggregate.label}
    </div>,
    formatInteger(aggregate.submitted),
    aggregate.submitted < SMALL_SAMPLE_THRESHOLD ? "小样本隐藏" : aggregate.average,
    <StatusBadge
      key="status"
      tone={aggregate.submitted < SMALL_SAMPLE_THRESHOLD ? "warning" : "success"}
    >
      {aggregate.submitted < SMALL_SAMPLE_THRESHOLD ? "样本不足" : "可分析"}
    </StatusBadge>,
  ]);
}

export default async function AdminReportsPage() {
  await requireRole([...ADMIN_REPORT_ROLES]);
  const { responses, isDatabaseConfigured } = await loadReportData();
  const aggregates = buildAggregates(responses);
  const scoredAnswers = responses.flatMap((response) =>
    response.answers.flatMap((answer) => (answer.score === null ? [] : [answer.score])),
  );
  const overallAverage =
    scoredAnswers.length === 0
      ? 0
      : Number(
          (
            scoredAnswers.reduce((total, score) => total + score, 0) /
            scoredAnswers.length
          ).toFixed(2),
        );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">统计报告</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          多维评价报告
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          基于已提交评价响应，按学校、院系、教师、课程和教学班汇总样本数与平均得分。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("统计报告")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="报告概览">
        <StatCard label="已提交响应" value={formatInteger(responses.length)} hint="仅统计 submitted responses" />
        <StatCard label="计分答案" value={formatInteger(scoredAnswers.length)} hint="剔除文本题与空分值" />
        <StatCard label="整体平均分" value={overallAverage} hint="按全部计分答案计算" />
        <StatCard label="小样本阈值" value={SMALL_SAMPLE_THRESHOLD} hint="低于阈值隐藏均分" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">学校汇总</h2>
          <DataTable
            headers={["学校", "提交数", "平均分", "状态"]}
            emptyText="暂无学校汇总。"
            rows={aggregateRows(aggregates.schools)}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">院系汇总</h2>
          <DataTable
            headers={["院系", "提交数", "平均分", "状态"]}
            emptyText="暂无院系汇总。"
            rows={aggregateRows(aggregates.departments)}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">教师汇总</h2>
          <DataTable
            headers={["教师", "提交数", "平均分", "状态"]}
            emptyText="暂无教师汇总。"
            rows={aggregateRows(aggregates.teachers)}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">课程汇总</h2>
          <DataTable
            headers={["课程", "提交数", "平均分", "状态"]}
            emptyText="暂无课程汇总。"
            rows={aggregateRows(aggregates.courses)}
          />
        </div>
      </section>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">教学班汇总</h2>
        <DataTable
          headers={["教学班", "提交数", "平均分", "状态"]}
          emptyText="暂无教学班汇总。"
          rows={aggregateRows(aggregates.classes)}
        />
      </div>
    </div>
  );
}
