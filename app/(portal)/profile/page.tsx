import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/guards";
import type { Role } from "@/lib/generated/prisma/enums";

const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "超级管理员",
  SCHOOL_ADMIN: "校级管理员",
  DEPARTMENT_ADMIN: "院系管理员",
  TEACHER: "教师",
  STUDENT: "学生",
  ANALYST: "分析员",
};

export default async function ProfilePage() {
  const session = await requireSession();
  const user = session.user;

  const fields = [
    { label: "用户 ID", value: user.id },
    { label: "姓名", value: user.name ?? "未设置" },
    { label: "邮箱", value: user.email ?? "未设置" },
    { label: "角色", value: roleLabels[user.role] },
    { label: "组织 ID", value: user.organizationId },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <StatusBadge tone="info">个人资料</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          当前登录信息
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          这些信息来自 NextAuth session，可用于后续任务的权限和组织范围控制。
        </p>
      </div>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
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
    </div>
  );
}
