import {
  buildExcelWorkbook,
  parseReportQuery,
} from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_REPORT_ROLES,
  SMALL_SAMPLE_THRESHOLD,
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
        sheetName: "题目维度分析",
      }),
      "question-report.xls",
    );
  }

  const url = new URL(request.url);
  const query = parseReportQuery(Object.fromEntries(url.searchParams.entries()));
  const { prisma } = await import("@/lib/db");
  const responses = await prisma.evaluationResponse.findMany({
    include: {
      answers: {
        select: {
          question: {
            select: {
              id: true,
              maxScore: true,
              title: true,
              type: true,
            },
          },
          score: true,
          text: true,
        },
      },
    },
    where: {
      assignment: { is: buildAssignmentWhere(query) },
      status: "SUBMITTED",
    },
  });
  const questions = new Map<
    string,
    {
      average: number;
      count: number;
      scoreTotal: number;
      textCount: number;
      title: string;
      type: string;
    }
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
        const score = scoreAnswerValue(answer.score, answer.question.maxScore);

        if (score !== null) {
          summary.count += 1;
          summary.scoreTotal += score;
          summary.average = roundMetric(summary.scoreTotal / summary.count);
        }
      }

      if (answer.text?.trim()) {
        summary.textCount += 1;
      }

      questions.set(answer.question.id, summary);
    });
  });

  const rows = Array.from(questions.values())
    .sort(
      (first, second) =>
        second.count - first.count || first.title.localeCompare(second.title, "zh-CN"),
    )
    .map((question) => [
      question.title,
      question.type === "SCALE" ? "量表题" : "开放题",
      question.count,
      question.count < SMALL_SAMPLE_THRESHOLD ? "小样本隐藏" : question.average,
      question.textCount,
    ]);

  return excelResponse(
    buildExcelWorkbook({
      headers: ["题目", "类型", "计分样本", "平均分", "文本意见"],
      rows,
      sheetName: "题目维度分析",
    }),
    "question-report.xls",
  );
}
