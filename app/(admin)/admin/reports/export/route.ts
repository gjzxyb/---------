import { buildCsv, parseReportQuery } from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_REPORT_ROLES,
  assignmentResponseRate,
  countSubmitted,
  formatPercent,
  isDatabaseConfigured,
} from "@/lib/demo-data";
import { averageResponseScore, responseScoreTotal } from "@/lib/evaluation/scoring";

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

  if (query.teacherName) {
    filters.push({
      teachingClass: {
        is: {
          teacher: {
            is: {
              name: { contains: query.teacherName },
            },
          },
        },
      },
    });
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
  const assignments = await prisma.evaluationAssignment.findMany({
    include: {
      response: {
        include: {
          answers: {
            select: {
              question: { select: { maxScore: true } },
              score: true,
              text: true,
            },
          },
        },
      },
      task: { select: { id: true, name: true, term: true } },
      teachingClass: {
        include: {
          course: { select: { code: true, name: true } },
          organization: { select: { name: true } },
          teacher: { select: { name: true } },
        },
      },
    },
    orderBy: [
      { task: { term: "desc" } },
      { task: { name: "asc" } },
      { teachingClass: { name: "asc" } },
    ],
    where: buildAssignmentWhere(query),
  });
  const buckets = new Map<
    string,
    {
      assigned: number;
      courseCode: string;
      courseName: string;
      organization: string;
      responseScores: number[];
      submitted: number;
      taskName: string;
      teacherName: string;
      teachingClass: string;
      term: string;
      textCount: number;
    }
  >();

  assignments.forEach((assignment) => {
    const teachingClass = assignment.teachingClass;
    const key = `${assignment.task.id}:${teachingClass.id}`;
    const bucket =
      buckets.get(key) ??
      ({
        assigned: 0,
        courseCode: teachingClass.course.code,
        courseName: teachingClass.course.name,
        organization: teachingClass.organization?.name ?? "未归属",
        responseScores: [],
        submitted: 0,
        taskName: assignment.task.name,
        teacherName: teachingClass.teacher.name,
        teachingClass: teachingClass.name,
        term: assignment.task.term || teachingClass.term,
        textCount: 0,
      });

    bucket.assigned += 1;

    if (countSubmitted([assignment]) > 0) {
      bucket.submitted += 1;
    }

    if (assignment.response?.status === "SUBMITTED") {
      const scoreSummary = responseScoreTotal(assignment.response.answers);

      if (scoreSummary !== null) {
        bucket.responseScores.push(scoreSummary.total);
      }

      bucket.textCount += assignment.response.answers.filter((answer) =>
        answer.text?.trim(),
      ).length;
    }

    buckets.set(key, bucket);
  });
  const rows = Array.from(buckets.values()).map((bucket) => [
    bucket.term,
    bucket.taskName,
    bucket.courseName,
    bucket.courseCode,
    bucket.teachingClass,
    bucket.teacherName,
    bucket.organization,
    bucket.submitted,
    bucket.assigned,
    formatPercent(
      assignmentResponseRate(
        Array.from({ length: bucket.assigned }, (_, index) => ({
          status: index < bucket.submitted ? "SUBMITTED" : "PENDING",
        })),
      ),
    ),
    bucket.responseScores.length,
    bucket.responseScores.length === 0
      ? ""
      : averageResponseScore(bucket.responseScores),
    bucket.textCount,
  ]);
  const csv = buildCsv(
    [
      "学期",
      "任务",
      "课程",
      "课程代码",
      "教学班",
      "教师",
      "组织",
      "已提交",
      "派发数",
      "回收率",
      "计分答卷数",
      "生均得分",
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
