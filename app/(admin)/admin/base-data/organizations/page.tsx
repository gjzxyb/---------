import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  createOrganization,
  deleteOrganization,
} from "@/app/actions/base-data";
import { requireRole } from "@/lib/auth/guards";
import { flattenOrganizationTree } from "@/lib/base-data/organization-tree";
import {
  ADMIN_ROLES,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

function orgTypeLabel(type: string) {
  return { SCHOOL: "学校", DEPARTMENT: "院系", CLASS: "行政班" }[type] ?? type;
}

function treePrefix(depth: number) {
  if (depth === 0) {
    return "";
  }

  return `${"　".repeat(Math.max(depth - 1, 0))}└─ `;
}

async function loadData() {
  if (!isDatabaseConfigured()) {
    return { organizations: [], isDatabaseConfigured: false };
  }

  const { prisma } = await import("@/lib/db");
  const organizations = await prisma.organization.findMany({
    include: {
      parent: { select: { name: true } },
      _count: {
        select: {
          children: true,
          users: true,
          courses: true,
          classes: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return {
    organizations: flattenOrganizationTree(organizations),
    isDatabaseConfigured: true,
  };
}

export default async function OrganizationsPage() {
  await requireRole([...ADMIN_ROLES]);
  const { organizations, isDatabaseConfigured } = await loadData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <StatusBadge tone="info">基础数据</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          组织结构
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          维护学校、院系和行政班级，供人员、课程和教学班归属使用。
        </p>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("组织结构")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="组织总数" value={formatInteger(organizations.length)} hint="全部层级" />
        <StatCard label="院系" value={formatInteger(organizations.filter((item) => item.type === "DEPARTMENT").length)} hint="部门节点" />
        <StatCard label="行政班" value={formatInteger(organizations.filter((item) => item.type === "CLASS").length)} hint="班级节点" />
      </section>

      <form
        action={createOrganization}
        className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-base font-semibold text-slate-950">新建组织</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            名称
            <input name="name" required className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            类型
            <select name="type" className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured}>
              <option value="SCHOOL">学校</option>
              <option value="DEPARTMENT">院系</option>
              <option value="CLASS">行政班</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            上级组织
            <select name="parentId" className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!isDatabaseConfigured}>
              <option value="">顶级组织</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {treePrefix(organization.depth)}
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <button className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!isDatabaseConfigured}>
            创建组织
          </button>
        </div>
      </form>

      <DataTable
        headers={["名称", "类型", "层级路径", "子级/用户/课程/班级", "操作"]}
        emptyText="暂无组织数据。"
        rows={organizations.map((organization) => {
          const canDelete =
            organization._count.children === 0 &&
            organization._count.users === 0 &&
            organization._count.courses === 0 &&
            organization._count.classes === 0;

          return [
            <div
              key="name"
              className="flex items-center gap-2"
              style={{ paddingLeft: `${organization.depth * 20}px` }}
            >
              <span className="font-mono text-xs text-slate-400">
                {organization.depth === 0 ? "●" : "└─"}
              </span>
              <span>
                <span className="font-medium text-slate-900">
                  {organization.name}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  第 {organization.depth + 1} 级
                </span>
              </span>
            </div>,
            orgTypeLabel(organization.type),
            organization.path,
            `${organization._count.children} / ${organization._count.users} / ${organization._count.courses} / ${organization._count.classes}`,
            <form key="delete" action={deleteOrganization}>
              <input type="hidden" name="id" value={organization.id} />
              <button
                disabled={!canDelete}
                title={canDelete ? "删除组织" : "存在关联数据，不可删除"}
                className="text-sm font-medium text-rose-700 disabled:text-slate-400"
              >
                删除
              </button>
            </form>,
          ];
        })}
      />
    </div>
  );
}
