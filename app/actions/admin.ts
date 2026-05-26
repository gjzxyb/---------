"use server";

import { revalidatePath } from "next/cache";

import { saveAdminSettings } from "@/lib/admin/settings-store";
import { canUpdateUserRole } from "@/lib/admin/user-role-permissions";
import { createSafeAuditLog } from "@/lib/audit-log";
import { ADMIN_ROLES, isDatabaseConfigured } from "@/lib/demo-data";
import {
  adminSettingsSchema,
  assignmentDeleteSchema,
  evaluationTaskSchema,
  questionBankDeleteSchema,
  questionBankItemSchema,
  taskAssignmentGenerationSchema,
  taskDeleteSchema,
  templateDeleteSchema,
  templateQuestionUpdateSchema,
  taskStatusUpdateSchema,
  templateSchema,
  userRoleUpdateSchema,
} from "@/lib/evaluation/validation";
import {
  buildAssignmentDrafts,
  resolveTeachingClassScope,
} from "@/lib/evaluation/task-publishing";
import { requireRole } from "@/lib/auth/guards";

function buildQuestionDescription(question: {
  category?: string;
  optionsText?: string;
}) {
  const parts = [
    question.category ? `分类：${question.category}` : null,
    question.optionsText ? `选项：${question.optionsText}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join("；") : null;
}

export async function createQuestionBankItem(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedItem = questionBankItemSchema.parse({
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    maxScore: String(formData.get("maxScore") ?? ""),
    isActive: formData.get("isActive"),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.questionBankItem.create({
    data: parsedItem,
  });

  revalidatePath("/admin/templates");
}

export async function deleteQuestionBankItem(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedQuestion = questionBankDeleteSchema.parse({
    questionId: String(formData.get("questionId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  const linkedTemplateQuestionCount = await prisma.templateQuestion.count({
    where: { questionItemId: parsedQuestion.questionId },
  });

  if (linkedTemplateQuestionCount > 0) {
    throw new Error("Question bank item is linked to templates and cannot be deleted.");
  }

  await prisma.questionBankItem.delete({
    where: { id: parsedQuestion.questionId },
  });

  revalidatePath("/admin/templates");
}

export async function createEvaluationTemplate(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedTemplate = templateSchema.parse({
    name: String(formData.get("name") ?? ""),
    version: String(formData.get("version") ?? ""),
    isActive: formData.get("isActive"),
    questionsJson: String(formData.get("questionsJson") ?? "[]"),
  });

  const { prisma } = await import("@/lib/db");
  await prisma.evaluationTemplate.create({
    data: {
      name: parsedTemplate.name,
      version: parsedTemplate.version,
      isActive: parsedTemplate.isActive,
      questions: {
        create: parsedTemplate.questions.map((question, index) => ({
          questionItemId: question.questionItemId,
          type: question.type,
          title: question.title,
          description: buildQuestionDescription(question),
          maxScore: question.maxScore,
          sortOrder: question.sortOrder || index + 1,
          required: question.required,
        })),
      },
    },
  });

  revalidatePath("/admin/templates");
}

export async function updateEvaluationTemplateQuestions(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedTemplate = templateQuestionUpdateSchema.parse({
    templateId: String(formData.get("templateId") ?? ""),
    isActive: formData.get("isActive"),
    questionsJson: String(formData.get("questionsJson") ?? "[]"),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.$transaction([
    prisma.templateQuestion.deleteMany({
      where: { templateId: parsedTemplate.templateId },
    }),
    prisma.evaluationTemplate.update({
      where: { id: parsedTemplate.templateId },
      data: {
        isActive: parsedTemplate.isActive,
        questions: {
          create: parsedTemplate.questions.map((question, index) => ({
            questionItemId: question.questionItemId,
            type: question.type,
            title: question.title,
            description: buildQuestionDescription(question),
            maxScore: question.maxScore,
            sortOrder: question.sortOrder || index + 1,
            required: question.required,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/admin/templates");
}

export async function deleteEvaluationTemplate(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedTemplate = templateDeleteSchema.parse({
    templateId: String(formData.get("templateId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  const linkedTaskCount = await prisma.evaluationTask.count({
    where: { templateId: parsedTemplate.templateId },
  });

  if (linkedTaskCount > 0) {
    throw new Error("Template has linked evaluation tasks and cannot be deleted.");
  }

  await prisma.evaluationTemplate.delete({
    where: { id: parsedTemplate.templateId },
  });

  revalidatePath("/admin/templates");
  revalidatePath("/admin/tasks");
}

export async function createEvaluationTask(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedTask = evaluationTaskSchema.parse({
    templateId: String(formData.get("templateId") ?? ""),
    name: String(formData.get("name") ?? ""),
    term: String(formData.get("term") ?? ""),
    status: String(formData.get("status") ?? "DRAFT"),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.evaluationTask.create({
    data: parsedTask,
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
}

export async function updateEvaluationTaskStatus(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedStatus = taskStatusUpdateSchema.parse({
    taskId: String(formData.get("taskId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.evaluationTask.update({
    where: { id: parsedStatus.taskId },
    data: { status: parsedStatus.status },
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
}

export async function generateEvaluationAssignments(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedGeneration = taskAssignmentGenerationSchema.parse({
    organizationIds: formData.getAll("organizationIds").map(String),
    taskId: String(formData.get("taskId") ?? ""),
    teachingClassIds: formData.getAll("teachingClassIds").map(String),
  });
  const { prisma } = await import("@/lib/db");

  const task = await prisma.evaluationTask.findUnique({
    where: { id: parsedGeneration.taskId },
    select: { id: true, term: true },
  });

  if (!task) {
    throw new Error("Evaluation task was not found.");
  }

  const [scopeTeachingClasses, organizations] = await Promise.all([
    prisma.teachingClass.findMany({
      where: { term: task.term },
      select: { id: true, organizationId: true },
    }),
    prisma.organization.findMany({
      select: { id: true, parentId: true },
    }),
  ]);
  const scopedTeachingClassIds = resolveTeachingClassScope({
    organizations,
    selectedOrganizationIds: parsedGeneration.organizationIds,
    selectedTeachingClassIds: parsedGeneration.teachingClassIds,
    teachingClasses: scopeTeachingClasses,
  });
  const hasExplicitScope =
    parsedGeneration.organizationIds.length > 0 ||
    parsedGeneration.teachingClassIds.length > 0;
  const teachingClassWhere =
    scopedTeachingClassIds.length > 0
      ? { teachingClassId: { in: scopedTeachingClassIds } }
      : hasExplicitScope
        ? { teachingClassId: { in: [] } }
        : { teachingClass: { term: task.term } };

  const [enrollments, existingAssignments] = await Promise.all([
    prisma.enrollment.findMany({
      where: teachingClassWhere,
      select: {
        student: { select: { status: true } },
        studentId: true,
        teachingClassId: true,
      },
      orderBy: [{ teachingClassId: "asc" }, { studentId: "asc" }],
    }),
    prisma.evaluationAssignment.findMany({
      where: { taskId: parsedGeneration.taskId },
      select: { evaluatorId: true, teachingClassId: true },
    }),
  ]);

  const drafts = buildAssignmentDrafts({
    enrollments: enrollments.map((enrollment) => ({
      studentId: enrollment.studentId,
      studentStatus: enrollment.student.status,
      teachingClassId: enrollment.teachingClassId,
    })),
    existingAssignments,
    teachingClassIds: scopedTeachingClassIds,
    taskId: parsedGeneration.taskId,
  });

  if (drafts.length > 0) {
    await prisma.evaluationAssignment.createMany({
      data: drafts,
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
  revalidatePath("/student/evaluations");
}

export async function closeEvaluationTaskAndExpirePending(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedTask = taskDeleteSchema.parse({
    taskId: String(formData.get("taskId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  await prisma.$transaction([
    prisma.evaluationTask.update({
      where: { id: parsedTask.taskId },
      data: { status: "CLOSED" },
    }),
    prisma.evaluationAssignment.updateMany({
      where: {
        taskId: parsedTask.taskId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        response: { is: null },
      },
      data: { status: "EXPIRED" },
    }),
  ]);

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
  revalidatePath("/student/evaluations");
}

export async function remindPendingEvaluationAssignments(formData: FormData) {
  const session = await requireRole([...ADMIN_ROLES]);
  const parsedTask = taskDeleteSchema.parse({
    taskId: String(formData.get("taskId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");
  const pendingCount = await prisma.evaluationAssignment.count({
    where: {
      taskId: parsedTask.taskId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      response: { isNot: { status: "SUBMITTED" } },
    },
  });

  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "REMIND_PENDING_EVALUATION_ASSIGNMENTS",
    entity: "EvaluationTask",
    entityId: parsedTask.taskId,
    metadata: { pendingCount },
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/audit-logs");
}

export async function deleteEvaluationAssignment(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedAssignment = assignmentDeleteSchema.parse({
    assignmentId: String(formData.get("assignmentId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  const responseCount = await prisma.evaluationResponse.count({
    where: { assignmentId: parsedAssignment.assignmentId },
  });

  if (responseCount > 0) {
    throw new Error("Evaluation assignment has response data and cannot be deleted.");
  }

  await prisma.evaluationAssignment.delete({
    where: { id: parsedAssignment.assignmentId },
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
  revalidatePath("/student/evaluations");
}

export async function deleteEvaluationTask(formData: FormData) {
  await requireRole([...ADMIN_ROLES]);
  const parsedTask = taskDeleteSchema.parse({
    taskId: String(formData.get("taskId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  const responseCount = await prisma.evaluationResponse.count({
    where: { assignment: { taskId: parsedTask.taskId } },
  });

  if (responseCount > 0) {
    throw new Error("Evaluation task has response data and cannot be deleted.");
  }

  await prisma.evaluationTask.delete({
    where: { id: parsedTask.taskId },
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
}

export async function updateAdminSettings(formData: FormData) {
  const session = await requireRole([...ADMIN_ROLES]);
  const parsedSettings = adminSettingsSchema.parse({
    academicYear: String(formData.get("academicYear") ?? ""),
    anonymousSubmission: formData.get("anonymousSubmission"),
    currentTerm: String(formData.get("currentTerm") ?? ""),
    dataIsolation: formData.get("dataIsolation"),
    dictionaryParametersText: String(formData.get("dictionaryParametersText") ?? ""),
    exportWatermark: formData.get("exportWatermark"),
    academicSystemEndpoint: String(formData.get("academicSystemEndpoint") ?? ""),
    textDesensitization: formData.get("textDesensitization"),
    lmsEndpoint: String(formData.get("lmsEndpoint") ?? ""),
    messageWebhook: String(formData.get("messageWebhook") ?? ""),
    smallSampleThreshold: String(formData.get("smallSampleThreshold") ?? ""),
    reminderChannels: formData.getAll("reminderChannels").map(String),
    resultReleaseMode: String(formData.get("resultReleaseMode") ?? ""),
    ssoProvider: String(formData.get("ssoProvider") ?? ""),
    termEndDate: String(formData.get("termEndDate") ?? ""),
    termStartDate: String(formData.get("termStartDate") ?? ""),
    interfaceNote: String(formData.get("interfaceNote") ?? ""),
  });

  await saveAdminSettings(parsedSettings);

  if (isDatabaseConfigured()) {
    const { prisma } = await import("@/lib/db");
    await createSafeAuditLog(prisma, {
      actorId: session.user.id,
      action: "UPDATE_ADMIN_SETTINGS",
      entity: "AdminSettings",
      metadata: {
        academicYear: parsedSettings.academicYear,
        currentTerm: parsedSettings.currentTerm,
        resultReleaseMode: parsedSettings.resultReleaseMode,
        smallSampleThreshold: parsedSettings.smallSampleThreshold,
      },
    });
  }

  revalidatePath("/admin/settings");
}

export async function updateUserRole(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  const parsedRole = userRoleUpdateSchema.parse({
    userId: String(formData.get("userId") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  const { prisma } = await import("@/lib/db");
  const targetUser = await prisma.user.findUnique({
    where: { id: parsedRole.userId },
    select: { email: true, id: true, name: true, role: true },
  });

  if (!targetUser) {
    throw new Error("User was not found.");
  }

  if (targetUser.role === parsedRole.role) {
    revalidatePath("/admin/settings");
    return;
  }

  const superAdminCount = await prisma.user.count({
    where: { role: "SUPER_ADMIN" },
  });
  const permission = canUpdateUserRole({
    actorRole: session.user.role,
    nextRole: parsedRole.role,
    superAdminCount,
    targetRole: targetUser.role,
  });

  if (!permission.allowed) {
    throw new Error(permission.reason);
  }

  await prisma.user.update({
    where: { id: parsedRole.userId },
    data: { role: parsedRole.role },
  });
  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "UPDATE_USER_ROLE",
    entity: "User",
    entityId: parsedRole.userId,
    metadata: {
      fromRole: targetUser.role,
      targetEmail: targetUser.email,
      targetName: targetUser.name,
      toRole: parsedRole.role,
    },
  });

  revalidatePath("/admin/settings");
}
