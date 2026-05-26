import { z } from "zod";

import { getPasswordComplexityErrors } from "../profile/validation";

export type CreateSuperAdminInput = {
  email: string;
  password: string;
  name: string;
};

const DEFAULT_SUPER_ADMIN_NAME = "超级管理员";

const emailSchema = z.string().trim().email("请输入有效邮箱");

function readOption(args: string[], name: string) {
  const equalsPrefix = `--${name}=`;
  const equalsValue = args.find((arg) => arg.startsWith(equalsPrefix));

  if (equalsValue) {
    return equalsValue.slice(equalsPrefix.length);
  }

  const index = args.indexOf(`--${name}`);

  if (index >= 0) {
    return args[index + 1];
  }

  return undefined;
}

export function parseCreateSuperAdminArgs(args: string[]): CreateSuperAdminInput {
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
  const email = readOption(args, "email") ?? positionalArgs[0];
  const password = readOption(args, "password") ?? positionalArgs[1];
  const name = readOption(args, "name") ?? positionalArgs[2] ?? DEFAULT_SUPER_ADMIN_NAME;

  if (!email) {
    throw new Error("请输入超级管理员邮箱");
  }

  const parsedEmail = emailSchema.safeParse(email);

  if (!parsedEmail.success) {
    throw new Error(parsedEmail.error.issues[0]?.message ?? "请输入有效邮箱");
  }

  if (!password) {
    throw new Error("请输入超级管理员初始密码");
  }

  const passwordErrors = getPasswordComplexityErrors(password);

  if (passwordErrors.length > 0) {
    throw new Error(`密码不符合复杂度要求：${passwordErrors.join("、")}`);
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("请输入超级管理员姓名");
  }

  return {
    email: parsedEmail.data.toLowerCase(),
    password,
    name: trimmedName,
  };
}
