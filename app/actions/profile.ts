"use server";

import { revalidatePath } from "next/cache";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireSession } from "@/lib/auth/guards";
import {
  passwordChangeSchema,
  profileUpdateSchema,
} from "@/lib/profile/validation";

export type ProfileActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const defaultErrorState: ProfileActionState = {
  ok: false,
  message: "提交失败，请检查输入内容。",
};

function buildFieldErrors(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "flatten" in error &&
    typeof error.flatten === "function"
  ) {
    return error.flatten().fieldErrors as Record<string, string[]>;
  }

  return undefined;
}

export async function updateOwnProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requireSession();
  const parsed = profileUpdateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });

  if (!parsed.success) {
    return {
      ...defaultErrorState,
      fieldErrors: buildFieldErrors(parsed.error),
    };
  }

  const { prisma } = await import("@/lib/db");
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true },
  });

  if (!currentUser) {
    return { ok: false, message: "当前用户不存在，请重新登录。" };
  }

  if (currentUser.name === parsed.data.name) {
    return { ok: true, message: "资料未变化。" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "UPDATE_PROFILE",
        entity: "User",
        entityId: session.user.id,
        metadata: {
          fromName: currentUser.name,
          toName: parsed.data.name,
        },
      },
    }),
  ]);

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return { ok: true, message: "个人资料已更新，顶部姓名会在重新登录后同步。" };
}

export async function changeOwnPassword(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await requireSession();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      ...defaultErrorState,
      fieldErrors: buildFieldErrors(parsed.error),
    };
  }

  const { prisma } = await import("@/lib/db");
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!currentUser) {
    return { ok: false, message: "当前用户不存在，请重新登录。" };
  }

  const isCurrentPasswordValid = await verifyPassword(
    parsed.data.currentPassword,
    currentUser.passwordHash,
  );

  if (!isCurrentPasswordValid) {
    return {
      ok: false,
      message: "当前密码不正确。",
      fieldErrors: { currentPassword: ["当前密码不正确"] },
    };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "CHANGE_PASSWORD",
        entity: "User",
        entityId: session.user.id,
        metadata: {
          changedBySelf: true,
        },
      },
    }),
  ]);

  revalidatePath("/profile");

  return { ok: true, message: "密码已修改，下次登录请使用新密码。" };
}
