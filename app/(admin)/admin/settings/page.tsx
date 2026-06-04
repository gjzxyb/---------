import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { updateAdminSettings, updateUserRole } from "@/app/actions/admin";
import { loadAdminSettings } from "@/lib/admin/settings-store";
import { canUpdateUserRole } from "@/lib/admin/user-role-permissions";
import { requireRole } from "@/lib/auth/guards";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  ADMIN_ROLES,
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

const rolePermissions = [
  ["SUPER_ADMIN", "全局配置、角色权限、全部数据、审计日志", "全部"],
  ["SCHOOL_ADMIN", "全校任务、模板、报表、基础数据", "全校"],
  ["DEPARTMENT_ADMIN", "本院系任务、模板、报表、基础数据", "本院系"],
  ["TEACHER", "任课信息、评教结果、整改计划", "本人相关"],
  ["STUDENT", "我的评教、建议反馈、本人信息", "本人相关"],
  ["ANALYST", "数据驾驶舱、报表中心、授权范围内分析", "只读"],
];

const resultReleaseLabels: Record<string, string> = {
  MANUAL: "管理员手动发布",
  SCHEDULED: "按设定时间发布",
  IMMEDIATE: "任务结束后自动发布",
};

const USER_PERMISSION_LIST_LIMIT = 10;

type RoleCount = {
  role: string;
  _count: { role: number };
};

type SettingsPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type AuditLogRow = {
  action: string;
  actor: { name: string; email: string } | null;
  createdAt: Date;
  entity: string;
  entityId: string | null;
  metadata: unknown;
};

type UserPermissionRow = {
  email: string;
  id: string;
  name: string;
  organization: { id: string; name: string };
  role: string;
  status: string;
};

type SettingsData = {
  auditLogs: AuditLogRow[];
  organizations: Array<{ id: string; name: string }>;
  roleCounts: RoleCount[];
  settings: Awaited<ReturnType<typeof loadAdminSettings>>;
  isDatabaseConfigured: boolean;
  taskCount: number;
  terms: string[];
  users: UserPermissionRow[];
  userTotalCount: number;
};

type UserPermissionQuery = {
  organizationId?: string;
  userQ?: string;
};

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseUserPermissionQuery(
  searchParams: Record<string, string | string[] | undefined>,
): UserPermissionQuery {
  const userQ = firstValue(searchParams.userQ)?.trim();
  const organizationId = firstValue(searchParams.organizationId)?.trim();

  return {
    organizationId: organizationId || undefined,
    userQ: userQ || undefined,
  };
}

function splitDictionaryParameters(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...valueParts] = line.split("=");
      return [
        name?.trim() || "未命名字典",
        valueParts.join("=").trim() || "未设置",
        "系统设置",
      ];
    });
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

async function loadSettingsData(
  userQuery: UserPermissionQuery,
): Promise<SettingsData> {
  const settings = await loadAdminSettings();

  if (!isDatabaseConfigured()) {
    return {
      auditLogs: [],
      organizations: [],
      roleCounts: [],
      settings,
      isDatabaseConfigured: false,
      taskCount: 0,
      terms: [],
      users: [],
      userTotalCount: 0,
    };
  }

  const { prisma } = await import("@/lib/db");
  const userFilters = [];

  if (userQuery.userQ) {
    userFilters.push({
      OR: [
        { name: { contains: userQuery.userQ } },
        { email: { contains: userQuery.userQ } },
      ],
    });
  }

  if (userQuery.organizationId) {
    userFilters.push({ organizationId: userQuery.organizationId });
  }

  const userWhere = userFilters.length > 0 ? { AND: userFilters } : {};
  const [
    roleCounts,
    auditLogs,
    tasks,
    classTerms,
    organizations,
    users,
    userTotalCount,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { role: true },
      orderBy: { role: "asc" },
    }),
    prisma.auditLog.findMany({
      include: { actor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.evaluationTask.findMany({
      orderBy: { createdAt: "desc" },
      select: { term: true },
    }),
    prisma.teachingClass.findMany({
      orderBy: { term: "desc" },
      select: { term: true },
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      include: { organization: { select: { id: true, name: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
      take: USER_PERMISSION_LIST_LIMIT,
      where: userWhere,
    }),
    prisma.user.count({ where: userWhere }),
  ]);
  const terms = Array.from(
    new Set([...tasks.map((task) => task.term), ...classTerms.map((item) => item.term)]),
  ).filter(Boolean);

  return {
    auditLogs,
    organizations,
    roleCounts,
    settings,
    isDatabaseConfigured: true,
    taskCount: tasks.length,
    terms,
    users,
    userTotalCount,
  };
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: SettingsPageSearchParams;
}) {
  const session = await requireRole([...ADMIN_ROLES]);
  const userQuery = parseUserPermissionQuery(await searchParams);
  const {
    auditLogs,
    organizations,
    roleCounts,
    settings,
    isDatabaseConfigured,
    taskCount,
    terms,
    users,
    userTotalCount,
  } = await loadSettingsData(userQuery);
  const superAdminCount =
    roleCounts.find((item) => item.role === "SUPER_ADMIN")?._count.role ?? 0;
  const dictionaryParameters = splitDictionaryParameters(
    settings.dictionaryParametersText,
  );
  const interfaceRows = [
    ["统一认证", settings.ssoProvider || "未配置", "CAS / LDAP / OAuth2 / SAML"],
    [
      "教务系统",
      settings.academicSystemEndpoint || "未配置",
      "同步课程、教学班、选课名单",
    ],
    ["LMS", settings.lmsEndpoint || "未配置", "同步学习平台课程与活动数据"],
    ["消息平台", settings.messageWebhook || "未配置", "站内信、邮件、企业微信、钉钉回调"],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge tone="info">系统设置</StatusBadge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            策略、权限与接口
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            维护学期学年、匿名隐私、角色权限说明、字典参数、接口配置和审计追踪。
          </p>
        </div>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("系统设置")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="设置概览">
        <StatCard label="当前学年" value={settings.academicYear} hint={settings.currentTerm} />
        <StatCard label="匿名策略" value={settings.anonymousSubmission ? "启用" : "停用"} hint="报告不展示学生身份" />
        <StatCard label="小样本阈值" value={settings.smallSampleThreshold} hint="低于阈值隐藏均分" />
        <StatCard label="评教任务" value={formatInteger(taskCount)} hint="已创建任务数" />
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <form className="p-5">
          <h2 className="text-base font-semibold text-slate-950">用户权限管理</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            按用户和组织筛选账号，直接调整系统角色；最后一个超级管理员不能被降权。
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              用户
              <input
                name="userQ"
                defaultValue={userQuery.userQ ?? ""}
                placeholder="姓名 / 邮箱"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              组织
              <select
                name="organizationId"
                defaultValue={userQuery.organizationId ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">全部组织</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                查询
              </button>
              <a
                href="/admin/settings"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                重置
              </a>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["用户", "组织", "账号状态", "当前角色", "授权操作"].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    暂无用户数据。
                  </td>
                </tr>
              ) : null}
              {users.map((user) => {
              const rolePermission = canUpdateUserRole({
                actorRole: session.user.role,
                nextRole: user.role as Role,
                superAdminCount,
                targetRole: user.role as Role,
              });
              const roleChangeDisabled = !rolePermission.allowed;

              return (
                <tr key={user.id}>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{user.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.organization.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {user.status === "ACTIVE" ? "启用" : "停用"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">
                      {roleLabels[user.role] ?? user.role}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{user.role}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <form action={updateUserRole} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={roleChangeDisabled}
                        title={roleChangeDisabled ? rolePermission.reason : "选择新角色"}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {Object.entries(roleLabels).map(([role, label]) => {
                          const optionPermission = canUpdateUserRole({
                            actorRole: session.user.role,
                            nextRole: role as Role,
                            superAdminCount,
                            targetRole: user.role as Role,
                          });

                          return (
                          <option
                            key={role}
                            value={role}
                            disabled={!optionPermission.allowed}
                          >
                            {label}
                          </option>
                          );
                        })}
                      </select>
                      <button
                        disabled={roleChangeDisabled}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:text-slate-400"
                      >
                        保存角色
                      </button>
                      {roleChangeDisabled ? (
                        <span className="text-xs text-amber-700">
                          {rolePermission.reason}
                        </span>
                      ) : null}
                    </form>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
          当前筛选共 {formatInteger(userTotalCount)} 个用户，列表最多展示前 {formatInteger(USER_PERMISSION_LIST_LIMIT)} 个。
        </div>
      </section>

      <form
        action={updateAdminSettings}
        className="space-y-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      >
        <section>
          <h2 className="text-base font-semibold text-slate-950">学期学年与发布策略</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              当前学年
              <input name="academicYear" defaultValue={settings.academicYear} required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              当前学期
              <input name="currentTerm" defaultValue={settings.currentTerm} list="term-options" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <datalist id="term-options">
                {terms.map((term) => (
                  <option key={term} value={term} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              学期开始
              <input name="termStartDate" type="date" defaultValue={settings.termStartDate ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              学期结束
              <input name="termEndDate" type="date" defaultValue={settings.termEndDate ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              结果发布
              <select name="resultReleaseMode" defaultValue={settings.resultReleaseMode} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="MANUAL">管理员手动发布</option>
                <option value="SCHEDULED">按设定时间发布</option>
                <option value="IMMEDIATE">任务结束后自动发布</option>
              </select>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-950">匿名隐私与权限隔离</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input name="anonymousSubmission" type="checkbox" defaultChecked={settings.anonymousSubmission} className="size-4 rounded border-slate-300" />
                启用匿名提交
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input name="textDesensitization" type="checkbox" defaultChecked={settings.textDesensitization} className="size-4 rounded border-slate-300" />
                启用文本反馈脱敏
              </label>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input name="dataIsolation" type="checkbox" defaultChecked={settings.dataIsolation} className="size-4 rounded border-slate-300" />
                启用院系数据隔离
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input name="exportWatermark" type="checkbox" defaultChecked={settings.exportWatermark} className="size-4 rounded border-slate-300" />
                导出报表加水印
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              小样本阈值
              <input name="smallSampleThreshold" type="number" min={1} max={50} defaultValue={settings.smallSampleThreshold} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700">提醒渠道</div>
              {["站内信", "短信", "邮件", "企业微信", "钉钉"].map((channel) => (
                <label key={channel} className="mr-4 inline-flex items-center gap-2 text-sm text-slate-700">
                  <input name="reminderChannels" type="checkbox" value={channel} defaultChecked={settings.reminderChannels.includes(channel)} className="size-4 rounded border-slate-300" />
                  {channel}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-950">接口配置</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              单点登录提供方
              <input name="ssoProvider" defaultValue={settings.ssoProvider ?? ""} placeholder="CAS / OAuth2 / LDAP" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              教务系统接口
              <input name="academicSystemEndpoint" defaultValue={settings.academicSystemEndpoint ?? ""} placeholder="https://..." className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              LMS 接口
              <input name="lmsEndpoint" defaultValue={settings.lmsEndpoint ?? ""} placeholder="https://..." className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              消息平台 Webhook
              <input name="messageWebhook" defaultValue={settings.messageWebhook ?? ""} placeholder="https://..." className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              接口配置说明
              <textarea name="interfaceNote" rows={3} defaultValue={settings.interfaceNote} required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-950">字典参数</h2>
          <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
            每行一个字典，格式为“名称=取值”
            <textarea name="dictionaryParametersText" rows={5} defaultValue={settings.dictionaryParametersText} required className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </section>

        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          保存设置
        </button>
      </form>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">角色权限矩阵</h2>
          <DataTable
            headers={["角色", "权限说明", "数据范围", "用户数"]}
            emptyText="暂无角色数据。"
            rows={rolePermissions.map(([role, permission, scope]) => {
              const roleCount =
                roleCounts.find((item) => item.role === role)?._count.role ?? 0;

              return [
                <div key="role">
                  <div className="font-medium text-slate-900">{roleLabels[role]}</div>
                  <div className="mt-1 text-xs text-slate-500">{role}</div>
                </div>,
                permission,
                scope,
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
              ["匿名提交", settings.anonymousSubmission ? "启用" : "停用", "报告页不展示学生姓名、学号、邮箱"],
              ["文本反馈脱敏", settings.textDesensitization ? "启用" : "停用", "开放意见查看前执行脱敏策略"],
              ["院系数据隔离", settings.dataIsolation ? "启用" : "停用", "院系管理员仅看本院系数据"],
              ["导出水印", settings.exportWatermark ? "启用" : "停用", "导出报表附加账号和时间水印"],
              ["结果发布", resultReleaseLabels[settings.resultReleaseMode], "控制教师端结果开放节奏"],
            ]}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">字典参数预览</h2>
          <DataTable headers={["字典", "取值", "来源"]} rows={dictionaryParameters} />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">接口配置预览</h2>
          <p className="text-sm leading-6 text-slate-600">{settings.interfaceNote}</p>
          <DataTable headers={["接口", "当前配置", "用途"]} rows={interfaceRows} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">最近审计日志</h2>
        <DataTable
          headers={["时间", "操作人", "动作", "对象", "摘要"]}
          emptyText="暂无审计日志。"
          rows={auditLogs.map((log) => [
            formatDateTime(log.createdAt),
            log.actor ? `${log.actor.name} (${log.actor.email})` : "系统",
            log.action,
            log.entityId ? `${log.entity} / ${log.entityId}` : log.entity,
            log.metadata ? JSON.stringify(log.metadata) : "-",
          ])}
        />
      </section>
    </div>
  );
}
