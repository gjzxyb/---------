import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/guards";
import type { Role, UserStatus } from "@/lib/generated/prisma/enums";

import {
  PasswordChangeForm,
  ProfileUpdateForm,
  StudentClassUpdateForm,
} from "./ProfileForms";

const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "超级管理员",
  SCHOOL_ADMIN: "校级管理员",
  DEPARTMENT_ADMIN: "院系管理员",
  TEACHER: "教师",
  STUDENT: "学生",
  ANALYST: "分析员",
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "启用",
  GRADUATED: "已毕业",
  INACTIVE: "停用",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function ProfilePage() {
  const session = await requireSession();
  const { prisma } = await import("@/lib/db");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: {
        select: { name: true, type: true },
      },
      studentProfile: {
        select: { grade: true, major: true, studentNo: true },
      },
      teacherProfile: {
        select: { teacherNo: true, title: true },
      },
    },
  });

  if (!user) {
    throw new Error("当前用户不存在，请重新登录。");
  }

  const classOrganizations =
    user.role === "STUDENT"
      ? await prisma.organization.findMany({
          where: { type: "CLASS" },
          select: {
            id: true,
            name: true,
            parent: { select: { name: true } },
          },
          orderBy: [{ parentId: "asc" }, { name: "asc" }],
        })
      : [];

  const fields = [
    { label: "用户 ID", value: user.id },
    { label: "姓名", value: user.name },
    { label: "邮箱", value: user.email },
    { label: "角色", value: roleLabels[user.role] },
    { label: "账号状态", value: statusLabels[user.status] },
    {
      label: "所属组织",
      value: `${user.organization.name}（${user.organization.type}）`,
    },
    { label: "创建时间", value: formatDate(user.createdAt) },
    { label: "更新时间", value: formatDate(user.updatedAt) },
  ];
  const studentFields = user.studentProfile
    ? [
        { label: "学号", value: user.studentProfile.studentNo },
        { label: "年级", value: user.studentProfile.grade ?? "未设置" },
        { label: "专业", value: user.studentProfile.major ?? "未设置" },
      ]
    : [];
  const teacherFields = user.teacherProfile
    ? [
        { label: "工号", value: user.teacherProfile.teacherNo },
        { label: "职称", value: user.teacherProfile.title ?? "未设置" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <StatusBadge tone="info">个人资料</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          账号与安全
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          查看当前账号、组织和身份资料；修改姓名与登录密码。角色、邮箱、组织和学籍/工号信息由管理员维护。
        </p>
      </div>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">基本信息</h2>
        </div>
        <dl className="divide-y divide-slate-200">
          {fields.map((field) => (
            <div
              key={field.label}
              className="grid gap-2 px-5 py-4 sm:grid-cols-[160px_1fr]"
            >
              <dt className="text-sm font-medium text-slate-500">{field.label}</dt>
              <dd className="break-words text-sm text-slate-950">{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {studentFields.length > 0 || teacherFields.length > 0 ? (
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">身份资料</h2>
          </div>
          <dl className="divide-y divide-slate-200">
            {[...studentFields, ...teacherFields].map((field) => (
              <div
                key={field.label}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[160px_1fr]"
              >
                <dt className="text-sm font-medium text-slate-500">{field.label}</dt>
                <dd className="break-words text-sm text-slate-950">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">修改资料</h2>
          <p className="mt-1 text-sm text-slate-600">
            姓名会用于页面展示、报表和操作审计。
          </p>
          <div className="mt-5">
            <ProfileUpdateForm name={user.name} />
          </div>
        </section>

        {user.role === "STUDENT" ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">修改班级</h2>
            <p className="mt-1 text-sm text-slate-600">
              学生可自行维护当前所属行政班级，便于通知和基础数据归属。
            </p>
            <div className="mt-5">
              <StudentClassUpdateForm
                classOptions={classOrganizations.map((organization) => ({
                  id: organization.id,
                  name: organization.name,
                  parentName: organization.parent?.name,
                }))}
                currentOrganizationId={user.organizationId}
              />
            </div>
          </section>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">修改密码</h2>
          <p className="mt-1 text-sm text-slate-600">
            修改密码需要验证当前密码，成功后会记录安全审计日志。
          </p>
          <div className="mt-5">
            <PasswordChangeForm />
          </div>
        </section>
      </div>
    </div>
  );
}
