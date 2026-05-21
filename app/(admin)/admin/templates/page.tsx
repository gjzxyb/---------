import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  activeStatusLabel,
  activeStatusTone,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type QuestionBankRow = {
  id: string;
  title: string;
  type: string;
  maxScore: number | null;
  isActive: boolean;
};

type TemplateRow = {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  _count: { questions: number; tasks: number };
};

type TemplateVersionRow = {
  name: string;
  _count: { version: number };
  _max: { version: number | null };
};

type TemplateData = {
  questionBankItems: QuestionBankRow[];
  templates: TemplateRow[];
  templateVersions: TemplateVersionRow[];
  questionTypes: { type: string; _count: { type: number } }[];
  isDatabaseConfigured: boolean;
};

async function loadTemplateData(): Promise<TemplateData> {
  if (!isDatabaseConfigured()) {
    return {
      questionBankItems: [],
      templates: [],
      templateVersions: [],
      questionTypes: [],
      isDatabaseConfigured: false,
    };
  }

  const { prisma } = await import("@/lib/db");
  const [questionBankItems, templates, templateVersions, questionTypes] =
    await Promise.all([
      prisma.questionBankItem.findMany({
        select: {
          id: true,
          title: true,
          type: true,
          maxScore: true,
          isActive: true,
        },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.evaluationTemplate.findMany({
        include: {
          _count: { select: { questions: true, tasks: true } },
        },
        orderBy: [{ name: "asc" }, { version: "desc" }],
      }),
      prisma.evaluationTemplate.groupBy({
        by: ["name"],
        _count: { version: true },
        _max: { version: true },
        orderBy: { name: "asc" },
      }),
      prisma.questionBankItem.groupBy({
        by: ["type"],
        _count: { type: true },
        orderBy: { type: "asc" },
      }),
    ]);

  return {
    questionBankItems,
    templates,
    templateVersions,
    questionTypes,
    isDatabaseConfigured: true,
  };
}

function questionTypeLabel(type: string) {
  return type === "SCALE" ? "量表题" : "文本题";
}

export default async function AdminTemplatesPage() {
  await requireRole([...ADMIN_ROLES]);
  const {
    questionBankItems,
    templates,
    templateVersions,
    questionTypes,
    isDatabaseConfigured,
  } = await loadTemplateData();
  const activeTemplates = templates.filter((template) => template.isActive).length;
  const activeQuestions = questionBankItems.filter((item) => item.isActive).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge tone="info">模板管理</StatusBadge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            评价模板与题库
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            首版提供题库、模板版本、题型和启用状态只读视图，便于发布前核对内容。
          </p>
        </div>
        <button
          type="button"
          disabled
          title="首版只读，暂不支持新建模板"
          className="rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
        >
          首版只读，暂不支持新建
        </button>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("模板数据")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="模板概览">
        <StatCard label="题库条目" value={formatInteger(questionBankItems.length)} hint={`${formatInteger(activeQuestions)} 个启用`} />
        <StatCard label="评价模板" value={formatInteger(templates.length)} hint={`${formatInteger(activeTemplates)} 个启用`} />
        <StatCard label="模板版本组" value={formatInteger(templateVersions.length)} hint="按模板名称归并" />
        <StatCard label="题型" value={formatInteger(questionTypes.length)} hint="当前题库覆盖题型" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">模板版本</h2>
          <DataTable
            headers={["模板", "版本", "题目数", "关联任务", "状态", "操作"]}
            emptyText="暂无模板。"
            rows={templates.map((template) => [
              template.name,
              `v${template.version}`,
              formatInteger(template._count.questions),
              formatInteger(template._count.tasks),
              <StatusBadge key="status" tone={activeStatusTone(template.isActive)}>
                {activeStatusLabel(template.isActive)}
              </StatusBadge>,
              <button
                key="action"
                type="button"
                disabled
                title="首版只读，暂不支持编辑模板"
                className="text-sm font-medium text-slate-400"
              >
                只读
              </button>,
            ])}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">题库条目</h2>
          <DataTable
            headers={["题目", "题型", "满分", "状态"]}
            emptyText="暂无题库条目。"
            rows={questionBankItems.map((item) => [
              <div key="title" className="max-w-md font-medium text-slate-900">
                {item.title}
              </div>,
              questionTypeLabel(item.type),
              item.maxScore ?? "不计分",
              <StatusBadge key="status" tone={activeStatusTone(item.isActive)}>
                {activeStatusLabel(item.isActive)}
              </StatusBadge>,
            ])}
          />
        </div>
      </section>

      <DataTable
        headers={["模板名称", "版本数量", "最新版本"]}
        emptyText="暂无模板版本。"
        rows={templateVersions.map((version) => [
          version.name,
          formatInteger(version._count.version),
          `v${version._max.version ?? 1}`,
        ])}
      />
    </div>
  );
}
