import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "../../lib/auth/guards";
import { evaluationSubmissionSchema } from "../../lib/evaluation/validation";

type ParsedEvaluationAnswer =
  | { questionId: string; score: number }
  | { questionId: string; text: string };

type ParsedEvaluationSubmission = {
  assignmentId: string;
  answers: ParsedEvaluationAnswer[];
};

export function parseEvaluationFormData(
  formData: FormData,
): ParsedEvaluationSubmission {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const answerMap = new Map<string, { score?: number; text?: string }>();

  for (const [key, value] of formData.entries()) {
    const match = /^answers\.([^.]+)\.(score|text)$/.exec(key);

    if (!match || typeof value !== "string") {
      continue;
    }

    const [, questionId, field] = match;
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      continue;
    }

    const answer = answerMap.get(questionId) ?? {};

    if (field === "score") {
      answer.score = Number(trimmedValue);
    } else {
      answer.text = trimmedValue;
    }

    answerMap.set(questionId, answer);
  }

  return {
    assignmentId,
    answers: Array.from(answerMap.entries()).map(([questionId, answer]) => {
      if (answer.score !== undefined) {
        return { questionId, score: answer.score };
      }

      return { questionId, text: answer.text ?? "" };
    }),
  };
}

async function persistEvaluation(
  formData: FormData,
  status: "DRAFT" | "SUBMITTED",
) {
  const session = await requireRole(["STUDENT"]);
  const rawSubmission = parseEvaluationFormData(formData);
  const parsedSubmission =
    status === "SUBMITTED" || rawSubmission.answers.length > 0
      ? evaluationSubmissionSchema.parse(rawSubmission)
      : rawSubmission;
  const { prisma } = await import("../../lib/db");

  const submittedAt = status === "SUBMITTED" ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    const assignment = await tx.evaluationAssignment.findFirst({
      where: {
        id: parsedSubmission.assignmentId,
        evaluatorId: session.user.id,
      },
      include: {
        task: {
          include: {
            template: {
              include: {
                questions: true,
              },
            },
          },
        },
        response: true,
      },
    });

    if (!assignment) {
      throw new Error("Evaluation assignment was not found.");
    }

    if (assignment.task.status !== "OPEN") {
      throw new Error("Evaluation task is not open.");
    }

    if (assignment.response?.status === "SUBMITTED") {
      throw new Error("Evaluation response has already been submitted.");
    }

    const questionsById = new Map(
      assignment.task.template.questions.map((question) => [
        question.id,
        question,
      ]),
    );
    const answeredQuestionIds = new Set(
      parsedSubmission.answers.map((answer) => answer.questionId),
    );

    for (const answer of parsedSubmission.answers) {
      const question = questionsById.get(answer.questionId);

      if (!question) {
        throw new Error("Evaluation answer references an unknown question.");
      }

      if ("score" in answer && question.type !== "SCALE") {
        throw new Error("Text question cannot receive a score answer.");
      }

      if ("text" in answer && question.type !== "TEXT") {
        throw new Error("Scale question cannot receive a text answer.");
      }
    }

    if (status === "SUBMITTED") {
      const missingRequiredQuestion = assignment.task.template.questions.find(
        (question) => question.required && !answeredQuestionIds.has(question.id),
      );

      if (missingRequiredQuestion) {
        throw new Error("All required questions must be answered before submit.");
      }
    }

    const existingResponse = assignment.response;
    const response = existingResponse
      ? await (async () => {
          const result = await tx.evaluationResponse.updateMany({
            where: {
              id: existingResponse.id,
              status: "DRAFT",
            },
            data: {
              status,
              submittedAt,
            },
          });

          if (result.count !== 1) {
            throw new Error("Evaluation response has already been submitted.");
          }

          return tx.evaluationResponse.findUniqueOrThrow({
            where: { id: existingResponse.id },
          });
        })()
      : await tx.evaluationResponse.create({
          data: {
            assignmentId: assignment.id,
            status,
            submittedAt,
          },
        });
    const editableQuestionIds = assignment.task.template.questions.map(
      (question) => question.id,
    );

    await tx.answer.deleteMany({
      where: {
        responseId: response.id,
        questionId: {
          in: editableQuestionIds,
          notIn: Array.from(answeredQuestionIds),
        },
      },
    });

    await Promise.all(
      parsedSubmission.answers.map((answer) =>
        tx.answer.upsert({
          where: {
            responseId_questionId: {
              responseId: response.id,
              questionId: answer.questionId,
            },
          },
          create: {
            responseId: response.id,
            questionId: answer.questionId,
            score: "score" in answer ? answer.score : null,
            text: "text" in answer ? answer.text : null,
          },
          update: {
            score: "score" in answer ? answer.score : null,
            text: "text" in answer ? answer.text : null,
          },
        }),
      ),
    );

    const assignmentUpdate = await tx.evaluationAssignment.updateMany({
      where: {
        id: assignment.id,
        evaluatorId: session.user.id,
        status: { not: "SUBMITTED" },
      },
      data: {
        status: status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
        submittedAt,
      },
    });

    if (assignmentUpdate.count !== 1) {
      throw new Error("Evaluation assignment has already been submitted.");
    }
  });

  revalidatePath("/student/evaluations");
  revalidatePath(`/student/evaluations/${parsedSubmission.assignmentId}`);
}

export async function saveEvaluationDraft(formData: FormData) {
  "use server";

  await persistEvaluation(formData, "DRAFT");
  redirect("/student/evaluations");
}

export async function submitEvaluation(formData: FormData) {
  "use server";

  await persistEvaluation(formData, "SUBMITTED");
  redirect("/student/evaluations");
}
