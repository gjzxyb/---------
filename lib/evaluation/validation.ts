import { z } from "zod";

const requiredString = z.string().trim().min(1);

const optionalDateField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue ? new Date(trimmedValue) : undefined;
}, z.date().optional().nullable());

const optionalTextField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue || undefined;
}, z.string().optional().nullable());

export const scaleAnswerSchema = z.strictObject({
  questionId: requiredString,
  score: z.number().int().min(1).max(5),
});

export const textAnswerSchema = z.strictObject({
  questionId: requiredString,
  text: requiredString,
});

export const evaluationSubmissionSchema = z
  .object({
    assignmentId: requiredString,
    answers: z
      .array(z.union([scaleAnswerSchema, textAnswerSchema]))
      .min(1, "At least one answer is required."),
  })
  .superRefine((submission, ctx) => {
    const seenQuestionIds = new Set<string>();

    submission.answers.forEach((answer, index) => {
      if (seenQuestionIds.has(answer.questionId)) {
        ctx.addIssue({
          code: "custom",
          message: "Each question can only be answered once.",
          path: ["answers", index, "questionId"],
        });
        return;
      }

      seenQuestionIds.add(answer.questionId);
    });
  });

export const improvementPlanSchema = z.object({
  teacherId: requiredString,
  teachingClassId: requiredString,
  title: requiredString,
  action: requiredString,
  status: z
    .enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
  deadline: optionalDateField,
  dueDate: optionalDateField,
  evidence: optionalTextField,
});

export type ScaleAnswer = z.infer<typeof scaleAnswerSchema>;
export type TextAnswer = z.infer<typeof textAnswerSchema>;
export type EvaluationSubmission = z.infer<typeof evaluationSubmissionSchema>;
export type ImprovementPlan = z.infer<typeof improvementPlanSchema>;
