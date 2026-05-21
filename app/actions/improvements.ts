"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import { improvementPlanSchema } from "@/lib/evaluation/validation";

const improvementStatusSchema = improvementPlanSchema.shape.status.unwrap();

export async function createImprovementPlan(formData: FormData) {
  const session = await requireRole(["TEACHER"]);

  const parsedPlan = improvementPlanSchema.parse({
    teacherId: session.user.id,
    teachingClassId: String(formData.get("teachingClassId") ?? ""),
    title: String(formData.get("title") ?? ""),
    action: String(formData.get("action") ?? ""),
    deadline: String(formData.get("deadline") ?? ""),
    evidence: String(formData.get("evidence") ?? ""),
  });
  const { prisma } = await import("@/lib/db");

  const teachingClass = await prisma.teachingClass.findFirst({
    where: {
      id: parsedPlan.teachingClassId,
      teacherId: session.user.id,
    },
    select: { id: true },
  });

  if (!teachingClass) {
    throw new Error("Teaching class was not found for current teacher.");
  }

  await prisma.improvementPlan.create({
    data: {
      teacherId: session.user.id,
      teachingClassId: parsedPlan.teachingClassId,
      title: parsedPlan.title,
      action: parsedPlan.action,
      dueDate: parsedPlan.deadline ?? parsedPlan.dueDate ?? null,
      evidence: parsedPlan.evidence ?? null,
    },
  });

  revalidatePath("/teacher/improvements");
  revalidatePath("/teacher/results");
  revalidatePath(`/teacher/results/${parsedPlan.teachingClassId}`);
}

export async function updateImprovementPlanStatus(formData: FormData) {
  const session = await requireRole(["TEACHER"]);
  const planId = String(formData.get("planId") ?? "");
  const status = improvementStatusSchema.parse(
    String(formData.get("status") ?? ""),
  );
  const { prisma } = await import("@/lib/db");

  const plan = await prisma.improvementPlan.findFirst({
    where: {
      id: planId,
      teacherId: session.user.id,
    },
    select: { id: true, teachingClassId: true },
  });

  if (!plan) {
    throw new Error("Improvement plan was not found for current teacher.");
  }

  await prisma.improvementPlan.update({
    where: { id: plan.id },
    data: { status },
  });

  revalidatePath("/teacher/improvements");
  revalidatePath("/teacher/results");
  revalidatePath(`/teacher/results/${plan.teachingClassId}`);
}
