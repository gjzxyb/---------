"use server";

import { revalidatePath } from "next/cache";

import { createSafeAuditLog } from "@/lib/audit-log";
import { requireRole } from "@/lib/auth/guards";
import {
  invalidateDashboardCaches,
  invalidateReportCaches,
  invalidateTeacherResultCaches,
} from "@/lib/cache/app-cache";
import {
  canMaintainTeachingClass,
  parseTeacherTeachingClassInput,
} from "@/lib/teacher/courses";

function resolveCurrentTerm(terms: string[], fallback: string) {
  return terms.length > 0
    ? [...terms].sort((first, second) => second.localeCompare(first, "zh-CN"))[0]
    : fallback;
}

async function assertCourseAndOrganization(
  courseId: string,
  organizationId: string | undefined,
) {
  const { prisma } = await import("@/lib/db");
  const [course, organization] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
    organizationId
      ? prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!course) {
    throw new Error("Course was not found.");
  }

  if (organizationId && !organization) {
    throw new Error("Organization was not found.");
  }
}

export async function createOwnTeachingClass(formData: FormData) {
  const session = await requireRole(["TEACHER"]);
  const parsed = parseTeacherTeachingClassInput({
    courseId: formData.get("courseId"),
    name: formData.get("name"),
    organizationId: formData.get("organizationId"),
    term: formData.get("term"),
  });
  const { prisma } = await import("@/lib/db");

  await assertCourseAndOrganization(parsed.courseId, parsed.organizationId);

  const duplicate = await prisma.teachingClass.findFirst({
    where: {
      courseId: parsed.courseId,
      name: parsed.name,
      teacherId: session.user.id,
      term: parsed.term,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Teaching class already exists for current teacher.");
  }

  const teachingClass = await prisma.teachingClass.create({
    data: {
      courseId: parsed.courseId,
      name: parsed.name,
      organizationId: parsed.organizationId,
      teacherId: session.user.id,
      term: parsed.term,
    },
    select: { id: true },
  });

  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "TEACHER_CREATE_TEACHING_CLASS",
    entity: "TeachingClass",
    entityId: teachingClass.id,
    metadata: {
      ...parsed,
      organizationId: parsed.organizationId ?? null,
    },
  });

  revalidatePath("/teacher/courses");
  revalidatePath("/teacher/results");
  await Promise.all([
    invalidateDashboardCaches(),
    invalidateReportCaches(),
    invalidateTeacherResultCaches(session.user.id),
  ]);
}

export async function updateOwnTeachingClass(formData: FormData) {
  const session = await requireRole(["TEACHER"]);
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Teaching class id is required.");
  }

  const { prisma } = await import("@/lib/db");
  const teachingClass = await prisma.teachingClass.findFirst({
    where: { id, teacherId: session.user.id },
    select: {
      courseId: true,
      id: true,
      name: true,
      organizationId: true,
      term: true,
      _count: { select: { assignments: true } },
    },
  });

  if (!teachingClass) {
    throw new Error("Teaching class was not found for current teacher.");
  }

  const terms = await prisma.teachingClass.findMany({
    where: { teacherId: session.user.id },
    select: { term: true },
  });
  const currentTerm = resolveCurrentTerm(
    terms.map((item) => item.term).filter(Boolean),
    teachingClass.term,
  );
  const maintenance = canMaintainTeachingClass({
    assignmentCount: teachingClass._count.assignments,
    currentTerm,
    term: teachingClass.term,
  });

  if (!maintenance.canEdit) {
    throw new Error("Only current-term teaching classes can be maintained.");
  }

  const parsed = parseTeacherTeachingClassInput({
    courseId: formData.get("courseId") ?? teachingClass.courseId,
    name: formData.get("name"),
    organizationId: formData.get("organizationId"),
    term: teachingClass.term,
  });

  if (!maintenance.canChangeCourse && parsed.courseId !== teachingClass.courseId) {
    throw new Error("Teaching class with evaluation assignments cannot change course.");
  }

  await assertCourseAndOrganization(parsed.courseId, parsed.organizationId);

  const duplicate = await prisma.teachingClass.findFirst({
    where: {
      courseId: parsed.courseId,
      id: { not: teachingClass.id },
      name: parsed.name,
      teacherId: session.user.id,
      term: teachingClass.term,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Teaching class already exists for current teacher.");
  }

  await prisma.teachingClass.update({
    where: { id: teachingClass.id },
    data: {
      courseId: maintenance.canChangeCourse
        ? parsed.courseId
        : teachingClass.courseId,
      name: parsed.name,
      organizationId: parsed.organizationId ?? null,
    },
  });
  await createSafeAuditLog(prisma, {
    actorId: session.user.id,
    action: "TEACHER_UPDATE_TEACHING_CLASS",
    entity: "TeachingClass",
    entityId: teachingClass.id,
    metadata: {
      after: {
        courseId: maintenance.canChangeCourse
          ? parsed.courseId
          : teachingClass.courseId,
        name: parsed.name,
        organizationId: parsed.organizationId ?? null,
      },
      before: {
        courseId: teachingClass.courseId,
        name: teachingClass.name,
        organizationId: teachingClass.organizationId,
      },
    },
  });

  revalidatePath("/teacher/courses");
  revalidatePath("/teacher/results");
  revalidatePath(`/teacher/results/${teachingClass.id}`);
  await Promise.all([
    invalidateDashboardCaches(),
    invalidateReportCaches(),
    invalidateTeacherResultCaches(session.user.id),
  ]);
}
