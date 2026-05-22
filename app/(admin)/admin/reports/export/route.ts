import { buildCsv, parseReportQuery } from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/guards";
import { ADMIN_REPORT_ROLES, isDatabaseConfigured, roundMetric } from "@/lib/demo-data";

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

export async function GET(request: Request) {
  await requireRole([...ADMIN_REPORT_ROLES]);

  if (!isDatabaseConfigured()) {
    return new Response("\uFEFF暂无数据", {
      headers: {
        "Content-Disposition": 'attachment; filename="evaluation-report.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  const url = new URL(request.url);
  const query = parseReportQuery(Object.fromEntries(url.searchParams.entries()));
  const { prisma } = await import("@/lib/db");
  const responses = await prisma.evaluationResponse.findMany({
    include: {
      answers: { select: { score: true, text: true } },
      assignment: {
        include: {
          task: { select: { name: true, term: true } },
          teachingClass: {
            include: {
              course: { select: { code: true, name: true } },
              organization: { select: { name: true } },
              teacher: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    where: {
      assignment: { is: buildAssignmentWhere(query) },
      status: "SUBMITTED",
    },
  });
  const rows = responses.map((response) => {
    const scores = response.answers.flatMap((answer) =>
      answer.score === null ? [] : [answer.score],
    );
    const average =
      scores.length === 0
        ? ""
        : roundMetric(scores.reduce((total, score) => total + score, 0) / scores.length);

    return [
      response.assignment.task.term,
      response.assignment.task.name,
      response.assignment.teachingClass.course.name,
      response.assignment.teachingClass.course.code,
      response.assignment.teachingClass.name,
      response.assignment.teachingClass.teacher.name,
      response.assignment.teachingClass.organization?.name ?? "未归属",
      response.submittedAt?.toISOString() ?? "",
      scores.length,
      average,
      response.answers.filter((answer) => answer.text?.trim()).length,
    ];
  });
  const csv = buildCsv(
    [
      "学期",
      "任务",
      "课程",
      "课程代码",
      "教学班",
      "教师",
      "组织",
      "提交时间",
      "计分答案数",
      "平均分",
      "文本意见数",
    ],
    rows,
  );

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="evaluation-report.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
