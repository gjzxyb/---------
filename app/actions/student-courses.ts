"use server";

import { revalidatePath } from "next/cache";

import { createSafeAuditLog } from "@/lib/audit-log";
import { requireRole } from "@/lib/auth/guards";
import { selfEnrollmentSchema } from "@/lib/student/self-enrollment";

export async function selfEnrollTeachingClass(formData: FormData) {
  const session = await requireRole(["STUDENT"]);
  const parsed = selfEnrollmentSchema.parse({
    teachingClassId: String(formData.get("teachingClassId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");
  const teachingClass = await prisma.teachingClass.findUnique({
    where: { id: parsed.teachingClassId },
    select: { id: true, name: true, term: true },
  });

  if (!teachingClass) {
    throw new Error("Teaching class was not found.");
  }

  await prisma.enrollment.upsert({
    where: {
      studentId_teachingClassId: {
        studentId: session.user.id,
        teachingClassId: parsed.teachingClassId,
      },
    },
    update: {},
    create: {
      studentId: session.user.id,
      teachingClassId: parsed.teachingClassId,
    },
  });
  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "STUDENT_SELF_ENROLL",
    entity: "TeachingClass",
    entityId: parsed.teachingClassId,
    metadata: {
      teachingClassName: teachingClass.name,
      term: teachingClass.term,
    },
  });

  revalidatePath("/student/courses");
  revalidatePath("/student/evaluations");
  revalidatePath("/dashboard");
}

export async function selfUnenrollTeachingClass(formData: FormData) {
  const session = await requireRole(["STUDENT"]);
  const parsed = selfEnrollmentSchema.parse({
    teachingClassId: String(formData.get("teachingClassId") ?? ""),
  });
  const { prisma } = await import("@/lib/db");
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_teachingClassId: {
        studentId: session.user.id,
        teachingClassId: parsed.teachingClassId,
      },
    },
    include: {
      teachingClass: {
        select: { name: true, term: true },
      },
    },
  });

  if (!enrollment) {
    revalidatePath("/student/courses");
    return;
  }

  const assignmentCount = await prisma.evaluationAssignment.count({
    where: {
      evaluatorId: session.user.id,
      teachingClassId: parsed.teachingClassId,
    },
  });

  if (assignmentCount > 0) {
    throw new Error("Enrollment has evaluation assignments and cannot be removed.");
  }

  await prisma.enrollment.delete({
    where: { id: enrollment.id },
  });
  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "STUDENT_SELF_UNENROLL",
    entity: "TeachingClass",
    entityId: parsed.teachingClassId,
    metadata: {
      teachingClassName: enrollment.teachingClass.name,
      term: enrollment.teachingClass.term,
    },
  });

  revalidatePath("/student/courses");
  revalidatePath("/student/evaluations");
  revalidatePath("/dashboard");
}
