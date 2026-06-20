import {
  buildExcelWorkbook,
  maskSensitiveText,
  parseReportQuery,
} from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_REPORT_ROLES,
  formatDateTime,
  isDatabaseConfigured,
} from "@/lib/demo-data";

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
        sheetName: "文本意见治理",
      }),
      "comment-report.xls",
    );
  }

  const url = new URL(request.url);
  const query = parseReportQuery(Object.fromEntries(url.searchParams.entries()));
  const { prisma } = await import("@/lib/db");
  const responses = await prisma.evaluationResponse.findMany({
    include: {
      answers: {
        select: {
          question: { select: { title: true } },
          text: true,
        },
      },
      assignment: {
        include: {
          teachingClass: {
            include: {
              course: { select: { name: true } },
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
  const rows = responses.flatMap((response) =>
    response.answers.flatMap((answer) => {
      const text = answer.text?.trim();

      if (!text) {
        return [];
      }

      return [
        [
          formatDateTime(response.submittedAt),
          `${response.assignment.teachingClass.course.name} / ${response.assignment.teachingClass.name}`,
          answer.question.title,
          maskSensitiveText(text),
        ],
      ];
    }),
  );

  return excelResponse(
    buildExcelWorkbook({
      headers: ["提交时间", "课程/教学班", "题目", "脱敏意见"],
      rows,
      sheetName: "文本意见治理",
    }),
    "comment-report.xls",
  );
}
