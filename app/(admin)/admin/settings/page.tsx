import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  SMALL_SAMPLE_THRESHOLD,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "超级管理员",
  SCHOOL_ADMIN: "校级管理员",
  DEPARTMENT_ADMIN: "院系管理员",
  TEACHER: "教师",
  STUDENT: "学生",
  ANALYST: "分析员",
};

const dictionaryParameters = [
  ["题型", "SCALE / TEXT", "来自 QuestionType 枚举"],
  ["任务状态", "DRAFT / OPEN / CLOSED / ARCHIVED", "来自 TaskStatus 枚举"],
  ["派发状态", "PENDING / IN_PROGRESS / SUBMITTED / EXPIRED", "来自 AssignmentStatus 枚举"],
  ["组织类型", "SCHOOL / DEPARTMENT / CLASS", "来自 OrgType 枚举"],
];

const interfaceConfiguration = [
  ["学生端", "/student/evaluations", "学生填写与提交评教"],
  ["教师端", "/teacher/results", "教师查看小样本保护后的评价结果"],
  ["管理端", "/admin/dashboard", "管理员查看任务、模板、报告和基础数据"],
  ["分析端", "/admin/reports", "分析员可只读查看统计报告"],
];

type RoleCount = {
  role: string;
  _count: { role: number };
};

type SettingsData = {
  roleCounts: RoleCount[];
  isDatabaseConfigured: boolean;
};

async function loadSettingsData(): Promise<SettingsData> {
  if (!isDatabaseConfigured()) {
    return { roleCounts: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const roleCounts = await prisma.user.groupBy({
    by: ["role"],
    _count: { role: true },
    orderBy: { role: "asc" },
  });

  return { roleCounts, isDatabaseConfigured: true };
}

export default async function AdminSettingsPage() {
  await requireRole([...ADMIN_ROLES]);
  const { roleCounts, isDatabaseConfigured } = await loadSettingsData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge tone="info">系统设置</StatusBadge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            策略与参数
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            首版只读展示角色、匿名策略、小样本阈值、字典参数和接口配置。
          </p>
        </div>
        <button
          type="button"
          disabled
          title="首版只读，暂不支持修改系统参数"
          className="rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
        >
          首版只读，暂不支持保存
        </button>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("系统设置")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="设置概览">
        <StatCard label="角色类型" value={Object.keys(roleLabels).length} hint="系统内置角色枚举" />
        <StatCard label="匿名策略" value="启用" hint="报告不展示学生身份" />
        <StatCard label="小样本阈值" value={SMALL_SAMPLE_THRESHOLD} hint="低于阈值隐藏均分" />
        <StatCard label="参数状态" value="只读" hint="首版不开放编辑" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">角色配置</h2>
          <DataTable
            headers={["角色", "权限说明", "用户数"]}
            emptyText="暂无角色数据。"
            rows={Object.entries(roleLabels).map(([role, label]) => {
              const roleCount =
                roleCounts.find((item) => item.role === role)?._count.role ?? 0;

              return [
                <div key="role">
                  <div className="font-medium text-slate-900">{label}</div>
                  <div className="mt-1 text-xs text-slate-500">{role}</div>
                </div>,
                role === "ANALYST"
                  ? "只读查看统计报告与扩展分析"
                  : ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])
                    ? "访问管理中心页面"
                    : "访问对应业务门户",
                formatInteger(roleCount),
              ];
            })}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">匿名与样本策略</h2>
          <DataTable
            headers={["参数", "当前值", "说明"]}
            rows={[
              ["匿名提交", "启用", "报告页不展示学生姓名、学号、邮箱"],
              ["小样本阈值", SMALL_SAMPLE_THRESHOLD, "低于阈值的聚合隐藏平均分"],
              ["文本反馈脱敏", "启用", "仅保留反馈文本和提交时间"],
              ["异常错误处理", "不吞错", "数据库已配置时真实查询错误继续抛出"],
            ]}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">字典参数</h2>
          <DataTable
            headers={["字典", "取值", "来源"]}
            rows={dictionaryParameters}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">接口配置</h2>
          <DataTable
            headers={["入口", "路径", "说明"]}
            rows={interfaceConfiguration}
          />
        </div>
      </section>
    </div>
  );
}
