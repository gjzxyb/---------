import { z } from "zod";

export const passwordComplexityRules = [
  {
    label: "至少 10 位字符",
    test: (password: string) => password.length >= 10,
  },
  {
    label: "包含大写字母",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    label: "包含小写字母",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    label: "包含数字",
    test: (password: string) => /\d/.test(password),
  },
  {
    label: "包含特殊字符",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const;

export function getPasswordComplexityErrors(password: string) {
  return passwordComplexityRules
    .filter((rule) => !rule.test(password))
    .map((rule) => rule.label);
}

export const profileUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "用户名/显示名称至少需要 2 个字符")
    .max(50, "用户名/显示名称不能超过 50 个字符"),
});

export const studentClassUpdateSchema = z.object({
  organizationId: z.string().trim().min(1, "请选择班级"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z.string().min(1, "请输入新密码"),
    confirmPassword: z.string().min(1, "请再次输入新密码"),
  })
  .superRefine((value, context) => {
    const complexityErrors = getPasswordComplexityErrors(value.newPassword);

    for (const message of complexityErrors) {
      context.addIssue({
        code: "custom",
        message,
        path: ["newPassword"],
      });
    }

    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: "custom",
        message: "新密码不能与当前密码相同",
        path: ["newPassword"],
      });
    }

    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "两次输入的新密码不一致",
        path: ["confirmPassword"],
      });
    }
  });
