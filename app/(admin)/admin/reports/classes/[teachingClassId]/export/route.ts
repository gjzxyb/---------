import {
  buildExcelWorkbook,
  maskSensitiveText,
  parseReportQuery,
} from "@/lib/admin/reports";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_REPORT_ROLES,
  assignmentStatusLabel,
  formatDateTime,
  isDatabaseConfigured,
  roundMetric,
} from "@/lib/demo-data";

type ClassReportDetailExportParams = Promise<{ teachingClassId: string }>;

function averageScore(scores: number[]) {
  if (scores.length === 0) {
    return "-";
  }

  return roundMetric(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function scoreDetails(
  answers: {
    question: { sortOrder: number; title: string };
    score: number | null;
  }[],
) {
  const scoreAnswers = answers
    .filter((answer) => answer.score !== null)
    .sort((first, second) => first.question.sortOrder - second.question.sortOrder);

  if (scoreAnswers.length === 0) {
    return "-";
  }

  return scoreAnswers
    .map((answer) => `${answer.question.title}：${answer.score}`)
    .join("；");
}

function textDetails(
  answers: {
    question: { title: string };
    text: string | null;
  }[],
) {
  const textAnswers = answers.flatMap((answer) => {
    const text = answer.text?.trim();

    return text ? [`${answer.question.title}：${maskSensitiveText(text)}`] : [];
  });

  return textAnswers.length > 0 ? textAnswers.join("；") : "-";
}

function excelResponse(workbook: string, filename: string) {
  return new Response(`\uFEFF${workbook}`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: ClassReportDetailExportParams },
) {
  await requireRole([...ADMIN_REPORT_ROLES]);

  if (!isDatabaseConfigured()) {
    return excelResponse(
      buildExcelWorkbook({
        headers: ["提示"],
        rows: [["暂无数据"]],
        sheetName: "学生评教明细",
      }),
      "class-evaluation-details.xls",
    );
  }

  const { teachingClassId } = await params;
  const url = new URL(request.url);
  const query = parseReportQuery(Object.fromEntries(url.searchParams.entries()));
  const { prisma } = await import("@/lib/db");
  const teachingClass = await prisma.teachingClass.findUnique({
    include: {
      assignments: {
        include: {
          response: {
            include: {
              answers: {
                include: {
                  question: {
                    select: { sortOrder: true, title: true },
                  },
                },
                orderBy: { question: { sortOrder: "asc" } },
              },
            },
          },
          task: { select: { name: true, term: true } },
        },
        orderBy: [{ task: { term: "desc" } }, { assignedAt: "desc" }],
        where: {
          ...(query.taskId ? { taskId: query.taskId } : {}),
          ...(query.term ? { task: { term: query.term } } : {}),
        },
      },
      course: { select: { code: true, name: true } },
      enrollments: {
        include: {
          student: {
            select: {
              email: true,
              id: true,
              name: true,
              studentProfile: { select: { studentNo: true } },
            },
          },
        },
        orderBy: { student: { name: "asc" } },
      },
      teacher: { select: { name: true } },
    },
    where: { id: teachingClassId },
  });

  if (!teachingClass) {
    return excelResponse(
      buildExcelWorkbook({
        headers: ["提示"],
        rows: [["教学班不存在"]],
        sheetName: "学生评教明细",
      }),
      "class-evaluation-details.xls",
    );
  }

  const assignmentsByStudent = new Map<string, typeof teachingClass.assignments>();

  teachingClass.assignments.forEach((assignment) => {
    assignmentsByStudent.set(assignment.evaluatorId, [
      ...(assignmentsByStudent.get(assignment.evaluatorId) ?? []),
      assignment,
    ]);
  });

  const rows = teachingClass.enrollments.flatMap((enrollment) => {
    const student = enrollment.student;
    const assignments = assignmentsByStudent.get(student.id) ?? [];
    const rowAssignments = assignments.length > 0 ? assignments : [null];

    return rowAssignments.map((assignment) => {
      const response = assignment?.response;
      const scores =
        response?.answers.flatMap((answer) =>
          answer.score === null ? [] : [answer.score],
        ) ?? [];

      return [
        student.name,
        student.email,
        student.studentProfile?.studentNo ?? "未建档",
        assignment ? `${assignment.task.term} · ${assignment.task.name}` : "未派发",
        assignment ? assignmentStatusLabel(assignment.status) : "未派发",
        formatDateTime(response?.submittedAt ?? assignment?.submittedAt),
        response?.status === "SUBMITTED" ? averageScore(scores) : "-",
        response?.status === "SUBMITTED" ? scoreDetails(response.answers) : "-",
        response?.status === "SUBMITTED" ? textDetails(response.answers) : "-",
      ];
    });
  });

  return excelResponse(
    buildExcelWorkbook({
      headers: [
        "学生",
        "邮箱",
        "学号",
        "评价任务",
        "状态",
        "提交时间",
        "平均分",
        "评分明细",
        "文本意见",
      ],
      rows,
      sheetName: `${teachingClass.name} 学生评教明细 · 任课教师：${teachingClass.teacher.name}`,
    }),
    "class-evaluation-details.xls",
  );
}
