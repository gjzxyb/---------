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

const optionalNumberField = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    return trimmedValue ? Number(trimmedValue) : undefined;
  }

  return value;
}, z.number().int().positive().optional().nullable());

const checkboxField = z.preprocess(
  (value) => value === true || value === "on" || value === "true",
  z.boolean(),
);

const optionalStringField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue || undefined;
}, z.string().optional());

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

export const questionBankItemSchema = z.object({
  type: z.enum(["SCALE", "TEXT"]),
  title: requiredString,
  description: optionalTextField,
  maxScore: optionalNumberField,
  isActive: checkboxField.default(false),
});

export const questionBankDeleteSchema = z.object({
  questionId: requiredString,
});

export const templateQuestionDraftSchema = z.object({
  questionItemId: optionalStringField,
  category: optionalStringField,
  sortOrder: z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z.number().int().min(1),
  ),
  title: requiredString,
  type: z.enum(["SCALE", "TEXT"]),
  maxScore: optionalNumberField,
  optionsText: z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    return value.trim();
  }, z.string().default("")),
  required: checkboxField.default(true),
});

export const templateSchema = z
  .object({
    name: requiredString,
    version: z.preprocess(
      (value) => (typeof value === "string" ? Number(value) : value),
      z.number().int().min(1),
    ),
    isActive: checkboxField.default(false),
    questionsJson: z.string().transform((value, ctx) => {
      try {
        return z
          .array(templateQuestionDraftSchema)
          .min(1)
          .parse(JSON.parse(value));
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Template must include at least one valid question.",
        });

        return z.NEVER;
      }
    }),
  })
  .transform(({ questionsJson, ...template }) => ({
    ...template,
    questions: questionsJson,
  }));

export const templateQuestionUpdateSchema = z
  .object({
    templateId: requiredString,
    isActive: checkboxField.default(false),
    questionsJson: z.string().transform((value, ctx) => {
      try {
        return z
          .array(templateQuestionDraftSchema)
          .min(1)
          .parse(JSON.parse(value));
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Template must include at least one valid question.",
        });

        return z.NEVER;
      }
    }),
  })
  .transform(({ questionsJson, ...template }) => ({
    ...template,
    questions: questionsJson,
  }));

export const templateDeleteSchema = z.object({
  templateId: requiredString,
});

export const evaluationTaskSchema = z.object({
  templateId: requiredString,
  name: requiredString,
  term: requiredString,
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]),
  startsAt: optionalDateField,
  endsAt: optionalDateField,
});

export const taskStatusUpdateSchema = z.object({
  taskId: requiredString,
  status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]),
});

export const taskAssignmentGenerationSchema = z.object({
  organizationIds: z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );
    }

    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }

    return [];
  }, z.array(requiredString)),
  taskId: requiredString,
  teachingClassIds: z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );
    }

    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }

    return [];
  }, z.array(requiredString)),
});

export const taskDeleteSchema = z.object({
  taskId: requiredString,
});

export const assignmentDeleteSchema = z.object({
  assignmentId: requiredString,
});

export const adminSettingsSchema = z.object({
  academicYear: requiredString,
  anonymousSubmission: checkboxField.default(false),
  currentTerm: requiredString,
  dataIsolation: checkboxField.default(false),
  dictionaryParametersText: requiredString,
  exportWatermark: checkboxField.default(false),
  academicSystemEndpoint: optionalStringField,
  lmsEndpoint: optionalStringField,
  messageWebhook: optionalStringField,
  resultReleaseMode: z.enum(["MANUAL", "SCHEDULED", "IMMEDIATE"]),
  textDesensitization: checkboxField.default(false),
  smallSampleThreshold: z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z.number().int().min(1).max(50),
  ),
  reminderChannels: z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return [value];
    }

    return [];
  }, z.array(requiredString)),
  ssoProvider: optionalStringField,
  termEndDate: optionalStringField,
  termStartDate: optionalStringField,
  interfaceNote: requiredString,
});

export const userRoleUpdateSchema = z.object({
  userId: requiredString,
  role: z.enum([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "DEPARTMENT_ADMIN",
    "TEACHER",
    "STUDENT",
    "ANALYST",
  ]),
});

export type ScaleAnswer = z.infer<typeof scaleAnswerSchema>;
export type TextAnswer = z.infer<typeof textAnswerSchema>;
export type EvaluationSubmission = z.infer<typeof evaluationSubmissionSchema>;
export type ImprovementPlan = z.infer<typeof improvementPlanSchema>;
export type QuestionBankItemInput = z.infer<typeof questionBankItemSchema>;
export type QuestionBankDeleteInput = z.infer<typeof questionBankDeleteSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type TemplateQuestionUpdateInput = z.infer<
  typeof templateQuestionUpdateSchema
>;
export type TemplateDeleteInput = z.infer<typeof templateDeleteSchema>;
export type EvaluationTaskInput = z.infer<typeof evaluationTaskSchema>;
export type TaskStatusUpdateInput = z.infer<typeof taskStatusUpdateSchema>;
export type TaskAssignmentGenerationInput = z.infer<
  typeof taskAssignmentGenerationSchema
>;
export type TaskDeleteInput = z.infer<typeof taskDeleteSchema>;
export type AssignmentDeleteInput = z.infer<typeof assignmentDeleteSchema>;
export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;
export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;
