import "dotenv/config";

import {
  OrgType,
  Role,
  UserStatus,
} from "../lib/generated/prisma/client";
import type { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { parseCreateSuperAdminArgs } from "../lib/admin/create-super-admin";

const DEFAULT_ORGANIZATION_ID = "default-organization";
const DEFAULT_ORGANIZATION_NAME = "默认组织";
let prismaClient: PrismaClient | undefined;

function printUsage() {
  console.info(
    [
      "用法：",
      "  npx tsx scripts/create-super-admin.ts <邮箱> <密码> [姓名]",
      "",
      "也支持：",
      "  npx tsx scripts/create-super-admin.ts --email <邮箱> --password <密码> --name <姓名>",
      "",
      "密码复杂度：至少 10 位，包含大写字母、小写字母、数字和特殊字符。",
    ].join("\n"),
  );
}

async function ensureDefaultOrganization(prisma: PrismaClient) {
  return prisma.organization.upsert({
    where: {
      id: DEFAULT_ORGANIZATION_ID,
    },
    update: {},
    create: {
      id: DEFAULT_ORGANIZATION_ID,
      name: DEFAULT_ORGANIZATION_NAME,
      type: OrgType.SCHOOL,
    },
  });
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const input = parseCreateSuperAdminArgs(process.argv.slice(2));
  const { prisma } = await import("../lib/db");
  prismaClient = prisma;
  const organization = await ensureDefaultOrganization(prisma);
  const passwordHash = await hashPassword(input.password);
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    select: {
      id: true,
      role: true,
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email: input.email,
    },
    update: {
      name: input.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      organizationId: organization.id,
    },
    create: {
      email: input.email,
      name: input.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      organizationId: organization.id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: existingUser ? "UPDATE_SUPER_ADMIN" : "CREATE_SUPER_ADMIN",
      entity: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        previousRole: existingUser?.role ?? null,
        createdBy: "scripts/create-super-admin.ts",
      },
    },
  });

  console.info(
    `${existingUser ? "已提升/更新" : "已创建"}超级管理员：${user.name} <${user.email}>`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaClient?.$disconnect();
  });
