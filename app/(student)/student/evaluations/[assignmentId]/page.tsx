import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Questionnaire,
  type QuestionnaireAnswer,
  type QuestionnaireQuestion,
} from "@/components/questionnaire";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";

type EvaluationDetail = {
  id: string;
  status: string;
  submittedAt: Date | null;
  task: {
    name: string;
    term: string;
    status: string;
    startsAt: Date | null;
    endsAt: Date | null;
    template: {
      questions: QuestionnaireQuestion[];
    };
  };
  teachingClass: {
    name: string;
    course: { name: string; code: string };
    teacher: { name: string };
  };
  response: {
    status: string;
    submittedAt: Date | null;
    answers: QuestionnaireAnswer[];
  } | null;
};

async function loadEvaluationDetail(
  assignmentId: string,
  userId: string,
): Promise<EvaluationDetail | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/db");
  return prisma.evaluationAssignment.findFirst({
    where: {
      id: assignmentId,
      evaluatorId: userId,
    },
    include: {
      task: {
        include: {
          template: {
            include: {
              questions: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
      teachingClass: {
        include: {
          course: true,
          teacher: true,
        },
      },
      response: {
        include: {
          answers: true,
        },
      },
    },
  });
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

function isWithinTaskWindow(task: EvaluationDetail["task"], now = new Date()) {
  return (!task.startsAt || task.startsAt <= now) && (!task.endsAt || task.endsAt >= now);
}

export default async function StudentEvaluationDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const session = await requireRole(["STUDENT"]);
  const { assignmentId } = await params;
  const assignment = await loadEvaluationDetail(assignmentId, session.user.id);

  if (!process.env.DATABASE_URL) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/student/evaluations"
          className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
        >
          返回我的评教
        </Link>
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          DATABASE_URL 未配置，暂时无法加载评教问卷。
        </section>
      </div>
    );
  }

  if (!assignment) {
    notFound();
  }

  const isSubmitted =
    assignment.status === "SUBMITTED" ||
    assignment.response?.status === "SUBMITTED";
  const isOpen = assignment.task.status === "OPEN";
  const isWithinWindow = isWithinTaskWindow(assignment.task);
  const isEditable = isOpen && isWithinWindow && !isSubmitted;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/student/evaluations"
        className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
      >
        返回我的评教
      </Link>

      <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusBadge tone={isSubmitted ? "success" : "info"}>
              {isSubmitted ? "Submitted" : "Questionnaire"}
            </StatusBadge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              {assignment.teachingClass.course.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {assignment.teachingClass.course.code} ·{" "}
              {assignment.teachingClass.name} ·{" "}
              {assignment.teachingClass.teacher.name}
            </p>
          </div>
          <div className="text-sm text-slate-600 sm:text-right">
            <div>{assignment.task.name}</div>
            <div className="mt-1">{assignment.task.term}</div>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="font-medium text-slate-500">开始日期</dt>
            <dd className="mt-1 text-slate-900">
              {formatDate(assignment.task.startsAt)}
            </dd>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="font-medium text-slate-500">截止日期</dt>
            <dd className="mt-1 text-slate-900">
              {formatDate(assignment.task.endsAt)}
            </dd>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="font-medium text-slate-500">提交日期</dt>
            <dd className="mt-1 text-slate-900">
              {formatDate(
                assignment.response?.submittedAt ?? assignment.submittedAt,
              )}
            </dd>
          </div>
        </dl>
      </section>

      {isSubmitted ? (
        <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          该评教已提交，不能重复提交。
        </section>
      ) : null}

      {!isOpen ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前评教任务未开放，暂时不能编辑。
        </section>
      ) : null}

      {isOpen && !isWithinWindow ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前不在评教任务时间窗口内，暂时不能编辑。
        </section>
      ) : null}

      <Questionnaire
        assignmentId={assignment.id}
        questions={assignment.task.template.questions}
        answers={assignment.response?.answers ?? []}
        disabled={!isEditable}
      />
    </div>
  );
}
