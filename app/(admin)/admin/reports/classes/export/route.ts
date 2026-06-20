import {
  buildExcelWorkbook,
  parseReportQuery,
} from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_REPORT_ROLES,
  SMALL_SAMPLE_THRESHOLD,
  assignmentResponseRate,
  countSubmitted,
  formatPercent,
  isDatabaseConfigured,
  roundMetric,
} from "@/lib/demo-data";

function scoreAnswerValue(score: number, maxScore: number | null | undefined) {
  if (!(typeof maxScore === "number" && Number.isFinite(maxScore) && maxScore > 0)) {
    return null;
  }

  return Math.min(score, maxScore);
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

function excelResponse(workbook: string, filename: string) {
  return new Response(`\uFEFF${workbook}`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    },
  });
}

export async function GET(request: Request) {
  await requireRole([...ADMIN_REPORT_ROLES]);

  if (!isDatabaseConfigured()) {
    return excelResponse(
      buildExcelWorkbook({
        headers: ["提示"],
        rows: [["暂无数据"]],
        sheetName: "教学班报表",
      }),
      "class-report.xls",
    );
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
            },
          },
        },
      },
      teachingClass: {
        include: {
          course: { select: { code: true, name: true } },
          organization: { select: { name: true } },
          teacher: { select: { name: true } },
        },
      },
    },
    orderBy: [
      { teachingClass: { term: "desc" } },
      { teachingClass: { name: "asc" } },
    ],
    where: buildAssignmentWhere(query),
  });
  const buckets = new Map<
    string,
    {
      assigned: number;
      course: string;
      organization: string;
      scoreCount: number;
      scoreTotal: number;
      submittedScoreCount: number;
      submittedScoreTotal: number;
      submitted: number;
      teacher: string;
      teachingClass: string;
      term: string;
    }
  >();

  assignments.forEach((assignment) => {
    const teachingClass = assignment.teachingClass;
    const bucket =
      buckets.get(teachingClass.id) ??
      {
        assigned: 0,
        course: `${teachingClass.course.name} (${teachingClass.course.code})`,
        organization: teachingClass.organization?.name ?? "未归属",
        scoreCount: 0,
        scoreTotal: 0,
        submittedScoreCount: 0,
        submittedScoreTotal: 0,
        submitted: 0,
        teacher: teachingClass.teacher.name,
        teachingClass: teachingClass.name,
        term: teachingClass.term,
      };

    bucket.assigned += 1;

    if (countSubmitted([assignment]) > 0) {
      bucket.submitted += 1;
    }

    let responseScore = 0;
    let responseScoreCount = 0;

    assignment.response?.answers.forEach((answer) => {
      if (assignment.response?.status === "SUBMITTED" && answer.score !== null) {
        const score = scoreAnswerValue(answer.score, answer.question.maxScore);

        if (score === null) {
          return;
        }

        bucket.scoreCount += 1;
        bucket.scoreTotal += score;
        responseScore += score;
        responseScoreCount += 1;
      }
    });

    if (assignment.response?.status === "SUBMITTED" && responseScoreCount > 0) {
      bucket.submittedScoreCount += 1;
      bucket.submittedScoreTotal += responseScore;
    }

    buckets.set(teachingClass.id, bucket);
  });

  const rows = Array.from(buckets.values()).map((bucket) => {
    const average =
      bucket.submitted < SMALL_SAMPLE_THRESHOLD || bucket.submittedScoreCount === 0
        ? "小样本隐藏"
        : roundMetric(bucket.submittedScoreTotal / bucket.submittedScoreCount);

    return [
      bucket.term,
      bucket.teachingClass,
      bucket.course,
      bucket.teacher,
      bucket.organization,
      bucket.submitted,
      bucket.assigned,
      formatPercent(assignmentResponseRate(
        Array.from({ length: bucket.assigned }, (_, index) => ({
          status: index < bucket.submitted ? "SUBMITTED" : "PENDING",
        })),
      )),
      average,
      bucket.submitted < SMALL_SAMPLE_THRESHOLD ? "样本不足" : "可分析",
    ];
  });

  return excelResponse(
    buildExcelWorkbook({
      headers: [
        "学期",
        "教学班",
        "课程",
        "教师",
        "组织",
        "已提交",
        "派发数",
        "回收率",
        "生均得分",
        "状态",
      ],
      rows,
      sheetName: "教学班报表",
    }),
    "class-report.xls",
  );
}
